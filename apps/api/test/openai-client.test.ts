import { describe, expect, test } from "bun:test";
import {
  AiDeadlineError,
  CHAT_MAX_TOKENS,
  createOpenAiClient,
  JSON_MAX_TOKENS,
} from "../src/ai/openai-client";
import { loadEnv } from "../src/env";
import { JWT_SECRET, TEST_CLIENT_ID } from "./helpers";

const env = loadEnv({
  DB_PATH: ":memory:",
  GOOGLE_CLIENT_IDS: TEST_CLIENT_ID,
  JWT_SECRET,
  OPENAI_API_KEY: "sk-test",
});

const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
  `data: ${JSON.stringify({
    id: "c1",
    object: "chat.completion.chunk",
    created: 0,
    model: "fake",
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;

/**
 * A fetch that answers with a stream of SSE pieces; `end: false` keeps it open
 * forever (until the request's signal aborts it), like a reply that never stops.
 */
function streamingFetch(pieces: string[], end: boolean, bodies: unknown[] = []) {
  return (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(encoder.encode(piece));
        if (end) controller.close();
        init?.signal?.addEventListener("abort", () =>
          controller.error(new DOMException("The operation was aborted.", "AbortError")),
        );
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

/** A fetch that never answers until its signal aborts. */
const silentFetch = (async (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  })) as typeof fetch;

const toolPiece = chunk({
  tool_calls: [
    {
      index: 0,
      id: "call_1",
      type: "function",
      function: {
        name: "create",
        arguments: '{"entity":"task","fields":"{\\"title\\":\\"very long',
      },
    },
  ],
});

describe("OpenAI client deadlines", () => {
  test("a stream that never ends stops at the deadline with a timed-out error", async () => {
    const ai = createOpenAiClient(env, {
      fetch: streamingFetch([toolPiece], false),
      deadlineMs: 80,
    })!;
    const started = Date.now();
    const result = ai.chat({ model: "smart", messages: [], tools: [], onText: () => {} });
    await expect(result).rejects.toBeInstanceOf(AiDeadlineError);
    await expect(result).rejects.toThrow("timed out");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("a call that never answers stops at the deadline too (with and without streaming)", async () => {
    const ai = createOpenAiClient(env, { fetch: silentFetch, deadlineMs: 50 })!;
    await expect(ai.chat({ model: "fast", messages: [], tools: [] })).rejects.toBeInstanceOf(
      AiDeadlineError,
    );
    await expect(
      ai.json({ model: "fast", system: "s", user: "u", schemaName: "x", jsonSchema: {} }),
    ).rejects.toBeInstanceOf(AiDeadlineError);
  });

  test("the caller going away mid-stream rejects instead of returning half a reply", async () => {
    const ai = createOpenAiClient(env, {
      fetch: streamingFetch([toolPiece], false),
      deadlineMs: 5000,
    })!;
    const phone = new AbortController();
    setTimeout(() => phone.abort(), 30);
    const result = ai.chat({
      model: "smart",
      messages: [],
      tools: [],
      onText: () => {},
      signal: phone.signal,
    });
    await expect(result).rejects.toBeDefined();
    await expect(result).rejects.not.toBeInstanceOf(AiDeadlineError);
  });

  test("every call caps its output, and a reply cut off at the cap says so", async () => {
    const bodies: Record<string, unknown>[] = [];
    const ai = createOpenAiClient(env, {
      fetch: streamingFetch([chunk({ content: "Half a sente" }, "length")], true, bodies),
    })!;
    const result = await ai.chat({ model: "smart", messages: [], tools: [], onText: () => {} });
    expect(result.truncated).toBe(true);
    expect(result.content).toBe("Half a sente");
    expect(bodies[0]?.max_completion_tokens).toBe(CHAT_MAX_TOKENS);

    const whole = await createOpenAiClient(env, {
      fetch: streamingFetch([chunk({ content: "Done." }, "stop")], true),
    })!.chat({ model: "smart", messages: [], tools: [], onText: () => {} });
    expect(whole.truncated).toBeUndefined();

    const jsonBodies: Record<string, unknown>[] = [];
    const jsonAi = createOpenAiClient(env, {
      fetch: (async (_url: unknown, init?: RequestInit) => {
        jsonBodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          id: "c1",
          object: "chat.completion",
          created: 0,
          model: "fake",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"ok":true}' },
              finish_reason: "stop",
            },
          ],
        });
      }) as typeof fetch,
    })!;
    const parsed = await jsonAi.json({
      model: "fast",
      system: "s",
      user: "u",
      schemaName: "x",
      jsonSchema: {},
    });
    expect(parsed.data).toEqual({ ok: true });
    expect(jsonBodies[0]?.max_completion_tokens).toBe(JSON_MAX_TOKENS);
  });
});
