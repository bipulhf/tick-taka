import { apiErrorFrom } from "@/lib/api";
import { apiUrl, currentToken, reportUnauthorized, ServerUnreachableError } from "@/lib/http";
import { noteServerTime, serverTimeOf } from "./server-clock";
import { createSseReader } from "./sse";

const TIMEOUT_MS = 180_000;

/**
 * POSTs JSON and reads the server-sent events in the reply as they arrive, calling
 * `onEvent` with each event's JSON. ky waits for whole bodies, so this uses fetch and
 * the body's stream directly. Errors before the stream starts come back as ApiError,
 * like `unwrap`; a dropped connection as ServerUnreachableError.
 */
export async function postEventStream(
  path: string,
  body: unknown,
  onEvent: (data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  try {
    const sentAt = Date.now();
    // Remembered so a 401 is judged against the token this request carried.
    const sentToken = currentToken();
    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...(sentToken ? { authorization: `Bearer ${sentToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ServerUnreachableError();
    }
    noteServerTime(serverTimeOf(response.headers), sentAt, Date.now());
    if (!response.ok || !response.body) {
      if (response.status === 401) reportUnauthorized(sentToken);
      throw apiErrorFrom(response.status, await response.json().catch(() => null));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const sse = createSseReader(onEvent);
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch {
        throw new ServerUnreachableError();
      }
      if (chunk.done) break;
      sse.push(decoder.decode(chunk.value, { stream: true }));
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
