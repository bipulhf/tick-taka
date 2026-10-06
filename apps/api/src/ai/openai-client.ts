import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Env } from "../env";
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

/** Longest one AI request may take before it is retried once (then fails as ai_error). */
export const AI_CALL_TIMEOUT_MS = 25_000;

/** OpenAI-backed AI client. The API key lives only in the server's environment. */
export function createOpenAiClient(env: Env): AiClient | null {
  if (!env.OPENAI_API_KEY) return null;
  // At most 2 × 25 s plus a short back-off, so a reply (or a clean 502) always beats
  // Nginx's 60 s proxy_read_timeout on the plain JSON routes.
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: AI_CALL_TIMEOUT_MS,
    maxRetries: 1,
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
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schemaName, schema: request.jsonSchema, strict: true },
        },
      });
      const content = completion.choices[0]?.message.content;
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
      const options = { signal: request.signal };
      if (!request.onText) {
        const completion = await openai.chat.completions.create(params, options);
        const message = completion.choices[0]?.message;
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
        };
      }

      const stream = await openai.chat.completions.create(
        { ...params, stream: true, stream_options: { include_usage: true } },
        options,
      );
      let content = "";
      let model = params.model;
      let usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
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
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          request.onText(delta.content);
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
      };
    },

    async transcribe(request) {
      const extension = EXTENSIONS[request.mimeType] ?? "m4a";
      const result = await openai.audio.transcriptions.create({
        file: await toFile(Buffer.from(request.audioBase64, "base64"), `voice.${extension}`, {
          type: request.mimeType,
        }),
        model: env.OPENAI_MODEL_TRANSCRIBE,
        prompt: request.prompt,
      });
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
