import { localMonthRange, toLocalMonth } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { type AiFeature, isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { and, gte, isNull, lt, sql } from "drizzle-orm";
import { aiUsage } from "../db/schema/system";
import type { Deps } from "../lib/deps";
import { AppError } from "../lib/errors";
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
  const cap = monthlyCapMicros(deps);
  if (cap !== null && monthSpendMicros(deps) >= cap) {
    throw new AppError(429, "ai_cap_reached", "This month's AI budget is used up");
  }
  return deps.ai;
}

/** Wraps provider failures so the client sees a clean, retryable error. */
export async function callAi<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[ai] call failed", error);
    throw new AppError(502, "ai_error", "AI didn't answer. Use the form instead.");
  }
}
