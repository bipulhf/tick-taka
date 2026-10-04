import { localMonthRange, toLocalMonth } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { type AiFeature, isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { and, gte, isNull, lt, sql } from "drizzle-orm";
import { aiUsage } from "../db/schema/system";
import type { Deps } from "../lib/deps";
import { AppError } from "../lib/errors";
import { userTime } from "../lib/user-time";
import type { AiClient, AiUsage } from "./client";

/** Cost of one call in micro-dollars, from the per-million-token prices in env. */
export function costMicros(deps: Deps, tier: "fast" | "smart", usage: AiUsage): number {
  const env = deps.env;
  const [input, output] =
    tier === "fast"
      ? [env.OPENAI_FAST_INPUT_MICROS_PER_MTOK, env.OPENAI_FAST_OUTPUT_MICROS_PER_MTOK]
      : [env.OPENAI_SMART_INPUT_MICROS_PER_MTOK, env.OPENAI_SMART_OUTPUT_MICROS_PER_MTOK];
  return Math.ceil((usage.inputTokens * input + usage.outputTokens * output) / 1_000_000);
}

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
      costMicros: costMicros(deps, tier, usage),
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Guardrails before any AI call: the off switch, per-feature opt-in, a configured
 * key and the monthly cost cap. Each failure has its own code so the app can fall
 * back to the plain form with nothing lost.
 */
export function requireAi(deps: Deps, feature: AiFeature): AiClient {
  const { settings } = userTime(deps);
  if (!isAiFeatureEnabled(settings, feature))
    throw new AppError(403, "ai_disabled", "AI is switched off for this");
  if (!deps.ai) throw new AppError(503, "ai_unavailable", "AI isn't set up on the server");
  if (monthSpendMicros(deps) >= settings.ai.monthlyCapMicros) {
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
