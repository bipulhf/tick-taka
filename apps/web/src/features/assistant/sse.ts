/**
 * Reads server-sent events from text chunks as they arrive: `push` each decoded
 * chunk, and `onData` gets each event's JSON. A partial event waits for the next
 * chunk; comments (": keepalive") and events without data are skipped. Pure, so it
 * can be tested.
 */
export function createSseReader(onData: (data: unknown) => void) {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      buffer = buffer.replaceAll("\r\n", "\n");
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
        if (data) onData(JSON.parse(data));
        end = buffer.indexOf("\n\n");
      }
    },
  };
}
