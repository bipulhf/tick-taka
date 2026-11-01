import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Env } from "../env";
import { log } from "../lib/log";
import type { AiChatMessage, AiClient, AiUsage } from "./client";

/** OpenAI picks the decoder from the file name, so each type needs an extension it knows. */
const EXTENSIONS: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/3gpp": "mp4",
};

/** Longest one AI request may wait for its first byte before it is retried once. */
export const AI_CALL_TIMEOUT_MS = 25_000;
/**
 * Longest one AI call may take start to finish, retry and streaming included. The
 * SDK's timeout only bounds the wait for the first byte, so a reply that keeps
 * streaming (a tool argument repeating itself) would otherwise never end. Nginx
 * allows 120 s on /ai/; a turn makes several calls, each well inside that.
 */
export const AI_CALL_DEADLINE_MS = 40_000;
/** Most tokens one chat reply may have: a few sentences, a form or a handful of tool calls. */
export const CHAT_MAX_TOKENS = 2_000;
/** Most tokens a structured answer (a parsed draft, a day plan, budgets) may have. */
export const JSON_MAX_TOKENS = 4_000;

/** An AI call that ran past its deadline; "timed out" makes callAi say it took too long. */
export class AiDeadlineError extends Error {
  override name = "AiDeadlineError";
}

/**
 * Runs one call with an overall deadline joined to the caller's signal. A stream the
 * SDK ends quietly on abort is never taken as a whole reply: the caller going away
 * rethrows its abort, the deadline throws AiDeadlineError.
 */
async function withDeadline<T>(
  what: string,
  ms: number,
  signal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = AbortSignal.timeout(ms);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const outcome = () => {
    if (signal?.aborted) return signal.reason ?? new Error("The AI call was cancelled");
    if (!deadline.aborted) return null;
    log("warn", "ai call deadline reached", { call: what, ms });
    return new AiDeadlineError(`AI call timed out after ${Math.round(ms / 1000)} s`);
  };
  let result: T;
  try {
    result = await run(combined);
  } catch (error) {
    throw outcome() ?? error;
  }
  const stopped = outcome();
  if (stopped) throw stopped;
  return result;
}

/** Test seams: a fake fetch and a short deadline. */
export interface OpenAiClientOptions {
  fetch?: typeof fetch;
  deadlineMs?: number;
}

/** OpenAI-backed AI client. The API key lives only in the server's environment. */
export function createOpenAiClient(env: Env, options: OpenAiClientOptions = {}): AiClient | null {
  if (!env.OPENAI_API_KEY) return null;
  const deadlineMs = options.deadlineMs ?? AI_CALL_DEADLINE_MS;
  // The first byte within 25 s, retried once; the whole call within 40 s.
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: AI_CALL_TIMEOUT_MS,
    maxRetries: 1,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const modelName = (model: "fast" | "smart") =>
    model === "fast" ? env.OPENAI_MODEL_FAST : env.OPENAI_MODEL_SMART;

  const toOpenAi = (message: AiChatMessage): ChatCompletionMessageParam => {
    switch (message.role) {
      case "tool":
        return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
      case "assistant":
        return {
          role: "assistant",
          content: message.content,
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: "function" as const,
                  function: { name: call.name, arguments: call.arguments },
                })),
              }
            : {}),
        };
      default:
        return { role: message.role, content: message.content };
    }
  };

  return {
    async json(request) {
      const model = modelName(request.model);
      const user =
        typeof request.user === "string"
          ? request.user
          : request.user.map((part) =>
              part.type === "text"
                ? { type: "text" as const, text: part.text }
                : {
                    type: "image_url" as const,
                    image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
                  },
            );
      const completion = await withDeadline("json", deadlineMs, undefined, (signal) =>
        openai.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: user },
            ],
            max_completion_tokens: JSON_MAX_TOKENS,
            response_format: {
              type: "json_schema",
              json_schema: { name: request.schemaName, schema: request.jsonSchema, strict: true },
            },
          },
          { signal },
        ),
      );
      const choice = completion.choices[0];
      if (choice?.finish_reason === "length")
        log("warn", "ai reply cut off at the token cap", { call: "json", max: JSON_MAX_TOKENS });
      const content = choice?.message.content;
      if (!content) throw new Error("Empty AI response");
      return {
        data: JSON.parse(content),
        model: completion.model,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          cachedInputTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
      };
    },

    async chat(request) {
      const params = {
        model: modelName(request.model),
        messages: request.messages.map(toOpenAi),
        // Function tools on Chat Completions require reasoning to be off for newer models.
        reasoning_effort: "none" as const,
        max_completion_tokens: CHAT_MAX_TOKENS,
        ...(request.tools.length
          ? {
              tools: request.tools.map((tool) => ({
                type: "function" as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                  strict: true,
                },
              })),
            }
          : {}),
      };
      const cutOff = (reason: string | null | undefined) => {
        if (reason !== "length") return false;
        log("warn", "ai reply cut off at the token cap", { call: "chat", max: CHAT_MAX_TOKENS });
        return true;
      };
      const { onText } = request;
      if (!onText) {
        const completion = await withDeadline("chat", deadlineMs, request.signal, (signal) =>
          openai.chat.completions.create(params, { signal }),
        );
        const choice = completion.choices[0];
        const message = choice?.message;
        return {
          content: message?.content ?? null,
          toolCalls: (message?.tool_calls ?? [])
            .filter((call) => call.type === "function")
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            })),
          model: completion.model,
          usage: {
            inputTokens: completion.usage?.prompt_tokens ?? 0,
            cachedInputTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
            outputTokens: completion.usage?.completion_tokens ?? 0,
          },
          ...(cutOff(choice?.finish_reason) ? { truncated: true } : {}),
        };
      }

      return withDeadline("chat stream", deadlineMs, request.signal, async (signal) => {
        const stream = await openai.chat.completions.create(
          { ...params, stream: true, stream_options: { include_usage: true } },
          { signal },
        );
        let content = "";
        let model = params.model;
        let usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
        let truncated = false;
        // Tool calls arrive in pieces, keyed by their position in the reply.
        const calls: { id: string; name: string; arguments: string }[] = [];
        for await (const chunk of stream) {
          model = chunk.model || model;
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              cachedInputTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }
          if (cutOff(chunk.choices[0]?.finish_reason)) truncated = true;
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            content += delta.content;
            onText(delta.content);
          }
          for (const part of delta?.tool_calls ?? []) {
            const call = calls[part.index] ?? { id: "", name: "", arguments: "" };
            calls[part.index] = call;
            if (part.id) call.id = part.id;
            if (part.function?.name) call.name += part.function.name;
            if (part.function?.arguments) call.arguments += part.function.arguments;
          }
        }
        return {
          content: content || null,
          toolCalls: calls.filter((call) => call.name),
          model,
          usage,
          ...(truncated ? { truncated: true } : {}),
        };
      });
    },

    async transcribe(request) {
      const extension = EXTENSIONS[request.mimeType] ?? "m4a";
      const file = await toFile(Buffer.from(request.audioBase64, "base64"), `voice.${extension}`, {
        type: request.mimeType,
      });
      const result = await withDeadline("transcribe", deadlineMs, undefined, (signal) =>
        openai.audio.transcriptions.create(
          { file, model: env.OPENAI_MODEL_TRANSCRIBE, prompt: request.prompt },
          { signal },
        ),
      );
      const usage = (
        result as { usage?: { type?: string; input_tokens?: number; output_tokens?: number } }
      ).usage;
      return {
        text: result.text.trim(),
        model: env.OPENAI_MODEL_TRANSCRIBE,
        usage: {
          inputTokens: usage?.type === "tokens" ? (usage.input_tokens ?? 0) : 0,
          outputTokens: usage?.type === "tokens" ? (usage.output_tokens ?? 0) : 0,
        },
      };
    },
  };
}
