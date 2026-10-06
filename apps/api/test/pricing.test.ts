import { describe, expect, test } from "bun:test";
import { costMicros } from "../src/ai/pricing";
import { loadEnv } from "../src/env";

const env = loadEnv({ GOOGLE_CLIENT_IDS: "x", JWT_SECRET: "x".repeat(32) });

describe("AI pricing", () => {
  test("gpt-6-luna at list price, with cached input at a tenth", () => {
    // 100k in + 100k out = $0.01 + $0.05
    const plain = { inputTokens: 100_000, outputTokens: 100_000 };
    expect(costMicros(env, "gpt-6-luna-2026-09-30", "smart", plain)).toBe(60_000);
    // Half the input from cache: $0.005 + $0.0005 + $0.05
    expect(costMicros(env, "gpt-6-luna", "smart", { ...plain, cachedInputTokens: 50_000 })).toBe(
      55_500,
    );
  });

  test("long prompts cost the long-context rate for the whole request", () => {
    expect(costMicros(env, "gpt-6-luna", "smart", { inputTokens: 300_000, outputTokens: 0 })).toBe(
      60_000,
    );
  });

  test("speech to text, and env prices for models not in the table", () => {
    expect(
      costMicros(env, "gpt-4o-mini-transcribe", "fast", { inputTokens: 1000, outputTokens: 100 }),
    ).toBe(1_750);
    expect(
      costMicros(env, "some-new-model", "fast", { inputTokens: 1_000_000, outputTokens: 0 }),
    ).toBe(env.OPENAI_FAST_INPUT_MICROS_PER_MTOK);
  });
});
