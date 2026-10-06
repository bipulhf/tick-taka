import type { AiChatResult, AiClient, AiJsonRequest, AiTranscribeRequest } from "../src/ai/client";

/** Scripted AI client: returns queued responses and records every request. */
export class FakeAi implements AiClient {
  readonly jsonRequests: AiJsonRequest[] = [];
  readonly chatRequests: Parameters<AiClient["chat"]>[0][] = [];
  private readonly jsonQueue: unknown[] = [];
  private readonly chatQueue: Partial<AiChatResult>[] = [];
  readonly transcribeRequests: AiTranscribeRequest[] = [];
  transcript = "";
  failNext = false;
  /** The abort signal each chat call was given. */
  readonly chatSignals: (AbortSignal | undefined)[] = [];
  /** Runs at the start of each chat call (1-based), e.g. to simulate the phone leaving. */
  beforeChat?: (call: number) => void | Promise<void>;

  queueJson(...data: unknown[]) {
    this.jsonQueue.push(...data);
    return this;
  }

  queueChat(...results: Partial<AiChatResult>[]) {
    this.chatQueue.push(...results);
    return this;
  }

  async json(request: AiJsonRequest) {
    this.jsonRequests.push(request);
    if (this.failNext) {
      this.failNext = false;
      throw new Error("provider down");
    }
    if (this.jsonQueue.length === 0) throw new Error("FakeAi: no queued json response");
    return {
      data: this.jsonQueue.shift(),
      usage: { inputTokens: 1000, outputTokens: 200 },
      model: "fake-fast",
    };
  }

  async chat(request: Parameters<AiClient["chat"]>[0]): Promise<AiChatResult> {
    const { onText, signal, ...recorded } = request;
    this.chatRequests.push(structuredClone(recorded));
    this.chatSignals.push(signal);
    await this.beforeChat?.(this.chatRequests.length);
    if (this.failNext) {
      this.failNext = false;
      throw new Error("provider down");
    }
    const next = this.chatQueue.shift() ?? { content: "done" };
    // Streams the reply word by word, like the real client.
    if (onText && next.content) for (const word of next.content.split(/(?<= )/)) onText(word);
    return {
      content: null,
      toolCalls: [],
      usage: { inputTokens: 500, outputTokens: 50 },
      model: "fake-fast",
      ...next,
    };
  }

  async transcribe(request: AiTranscribeRequest) {
    this.transcribeRequests.push(request);
    return {
      text: this.transcript,
      usage: { inputTokens: 100, outputTokens: 20 },
      model: "fake-transcribe",
    };
  }
}
