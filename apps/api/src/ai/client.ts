/**
 * The only door to OpenAI. Routes depend on this interface so tests can pass a fake.
 */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from OpenAI's prompt cache, billed at a lower rate. */
  cachedInputTokens?: number;
}

export interface AiJsonRequest {
  model: "fast" | "smart";
  system: string;
  user: string | AiUserContent[];
  schemaName: string;
  /** JSON schema for Structured Outputs (strict mode). */
  jsonSchema: Record<string, unknown>;
}

export type AiUserContent =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; base64: string };

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type AiChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface AiChatResult {
  content: string | null;
  toolCalls: AiToolCall[];
  usage: AiUsage;
  model: string;
}

export interface AiTranscribeRequest {
  audioBase64: string;
  mimeType: string;
  /** Vocabulary hint, e.g. the languages and app words to expect. */
  prompt: string;
}

export interface AiClient {
  json(request: AiJsonRequest): Promise<{ data: unknown; usage: AiUsage; model: string }>;
  chat(request: {
    model: "fast" | "smart";
    messages: AiChatMessage[];
    /** Empty means the model must answer in text. */
    tools: AiToolDefinition[];
    /** When given, the reply streams: called with each piece of text as it arrives. */
    onText?: (delta: string) => void;
  }): Promise<AiChatResult>;
  transcribe(
    request: AiTranscribeRequest,
  ): Promise<{ text: string; usage: AiUsage; model: string }>;
}
