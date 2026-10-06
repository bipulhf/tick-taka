import { localMonthRange, toLocalMonth } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { type AiFeature, isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { and, gte, isNull, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { aiUsage } from "../db/schema/system";
import type { Deps } from "../lib/deps";
import { AppError } from "../lib/errors";
import { errorFields, log } from "../lib/log";
import { currentScope } from "../lib/user-scope";
import { userTime } from "../lib/user-time";
import type { AiClient, AiUsage } from "./client";
import { costMicros } from "./pricing";

export function monthSpendMicros(deps: Deps): number {
  const { timeZone, now } = userTime(deps);
  const range = localMonthRange(toLocalMonth(now, timeZone), timeZone);
  return (
    deps.db
      .select({ total: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)` })
      .from(aiUsage)
      .where(
        and(
          isNull(aiUsage.deletedAt),
          gte(aiUsage.createdAt, range.from),
          lt(aiUsage.createdAt, range.to),
        ),
      )
      .get()?.total ?? 0
  );
}

export function logUsage(
  deps: Deps,
  feature: AiFeature,
  tier: "fast" | "smart",
  model: string,
  usage: AiUsage,
) {
  const now = deps.now();
  deps.db
    .insert(aiUsage)
    .values({
      id: newId(now),
      feature,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costMicros: costMicros(deps.env, model, tier, usage),
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Most the signed-in user's AI may cost this month, or null for no limit. The owner
 * (OWNER_EMAIL) pays the bill and is never limited; everyone else gets the server's
 * AI_USER_MONTHLY_CAP_MICROS (0 turns the limit off).
 */
export function monthlyCapMicros(deps: Deps): number | null {
  const email = currentScope()?.user.email;
  if (email && email === deps.env.OWNER_EMAIL) return null;
  return deps.env.AI_USER_MONTHLY_CAP_MICROS || null;
}

/**
 * Guardrails before any AI call: the off switch, per-feature opt-in, a configured
 * key and, for users other than the owner, the server's monthly cost cap. Each
 * failure has its own code so the app can fall back to the plain form with
 * nothing lost.
 */
export function requireAi(deps: Deps, feature: AiFeature): AiClient {
  const { settings } = userTime(deps);
  if (!isAiFeatureEnabled(settings, feature))
    throw new AppError(403, "ai_disabled", "AI is switched off for this");
  if (!deps.ai) throw new AppError(503, "ai_unavailable", "AI isn't set up on the server");
  assertUnderCap(deps);
  return capEveryCall(deps, deps.ai);
}

function assertUnderCap(deps: Deps): void {
  const cap = monthlyCapMicros(deps);
  if (cap !== null && monthSpendMicros(deps) >= cap) {
    throw new AppError(429, "ai_cap_reached", "This month's AI budget is used up");
  }
}

/**
 * The client a feature gets: the cap is checked again before every call, so a
 * feature that makes several calls (the assistant, ask) stops at the cap
 * instead of running past it.
 */
function capEveryCall(deps: Deps, ai: AiClient): AiClient {
  return {
    json(request) {
      assertUnderCap(deps);
      return ai.json(request);
    },
    chat(request) {
      assertUnderCap(deps);
      return ai.chat(request);
    },
    transcribe(request) {
      assertUnderCap(deps);
      return ai.transcribe(request);
    },
  };
}

const isTimeout = (error: unknown) =>
  error instanceof Error && /timeout|timed out/i.test(`${error.name} ${error.message}`);

/**
 * Wraps provider failures so the client sees a clean, retryable 502 `ai_error`
 * (a timeout included) and falls back to the plain form. A call cancelled
 * through `signal` (the phone went away) is rethrown as it is.
 */
export async function callAi<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError || signal?.aborted) throw error;
    log("warn", "ai call failed", errorFields(error));
    throw new AppError(
      502,
      "ai_error",
      isTimeout(error)
        ? "AI took too long to answer. Use the form instead."
        : "AI didn't answer. Use the form instead.",
    );
  }
}

/**
 * Checks a model's reply against the feature's schema. Structured Outputs make a
 * mismatch rare; when one happens it is the AI's failure (502 `ai_error`), not
 * the server's.
 */
export function parseAiOutput<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  log("warn", "ai output did not match its schema", {
    issues: parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  });
  throw new AppError(
    502,
    "ai_error",
    "AI gave an answer the app couldn't use. Use the form instead.",
  );
}
