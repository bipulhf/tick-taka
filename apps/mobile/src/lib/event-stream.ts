import { fetch } from "expo/fetch";
import { apiErrorFrom } from "./api";
import { apiUrl, currentToken, reportUnauthorized, ServerUnreachableError } from "./http";
import { noteServerTime, serverTimeOf } from "./server-clock";

const TIMEOUT_MS = 180_000;

/**
 * POSTs JSON and reads the server-sent events in the reply as they arrive, calling
 * `onEvent` with each event's JSON. React Native's own fetch can't stream, so this
 * uses Expo's. Errors before the stream starts come back as ApiError, like `unwrap`.
 */
export async function postEventStream(
  path: string,
  body: unknown,
  onEvent: (data: unknown) => void,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const sentAt = Date.now();
    // Remembered so a 401 is judged against the token this request carried.
    const sentToken = currentToken();
    let response: Awaited<ReturnType<typeof fetch>>;
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
    let buffer = "";
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch {
        throw new ServerUnreachableError();
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true }).replaceAll("\r\n", "\n");
      // Events end with a blank line; keep a partial one for the next chunk.
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const data = buffer
          .slice(0, end)
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        buffer = buffer.slice(end + 2);
        if (data) onEvent(JSON.parse(data));
        end = buffer.indexOf("\n\n");
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
