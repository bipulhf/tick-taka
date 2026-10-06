import type { Env } from "../env";
import type { AiUsage } from "./client";

/** Micro-dollars per million tokens. */
interface Price {
  input: number;
  cachedInput: number;
  output: number;
}

/**
 * OpenAI's list prices (developers.openai.com/api/docs/pricing, October 2026),
 * matched by the start of the model name the API reports, e.g. gpt-6-luna-2026-09-30.
 * Above `longContextFrom` input tokens the whole request costs the long rate.
 */
const PRICES: { model: string; price: Price; longContextFrom?: number; long?: Price }[] = [
  {
    model: "gpt-6-luna",
    price: { input: 100_000, cachedInput: 10_000, output: 500_000 },
    longContextFrom: 272_000,
    long: { input: 200_000, cachedInput: 20_000, output: 750_000 },
  },
  {
    model: "gpt-4o-mini-transcribe",
    price: { input: 1_250_000, cachedInput: 1_250_000, output: 5_000_000 },
  },
];

/** Prices from env, for a model missing from the table above. */
function fallback(env: Env, tier: "fast" | "smart"): Price {
  const [input, output] =
    tier === "fast"
      ? [env.OPENAI_FAST_INPUT_MICROS_PER_MTOK, env.OPENAI_FAST_OUTPUT_MICROS_PER_MTOK]
      : [env.OPENAI_SMART_INPUT_MICROS_PER_MTOK, env.OPENAI_SMART_OUTPUT_MICROS_PER_MTOK];
  return { input, cachedInput: input, output };
}

/** What one call cost in micro-dollars; cached input tokens are billed at their lower rate. */
export function costMicros(
  env: Env,
  model: string,
  tier: "fast" | "smart",
  usage: AiUsage,
): number {
  const known = PRICES.find((entry) => model.startsWith(entry.model));
  const price =
    known?.long && known.longContextFrom && usage.inputTokens > known.longContextFrom
      ? known.long
      : (known?.price ?? fallback(env, tier));
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  return Math.ceil(
    ((usage.inputTokens - cached) * price.input +
      cached * price.cachedInput +
      usage.outputTokens * price.output) /
      1_000_000,
  );
}
