import { describe, expect, test } from "bun:test";
import { createSseReader } from "../src/features/assistant/sse";

const read = (chunks: string[]) => {
  const events: unknown[] = [];
  const reader = createSseReader((data) => events.push(data));
  for (const chunk of chunks) reader.push(chunk);
  return events;
};

describe("server-sent events", () => {
  test("each event's data is parsed as JSON, with the event name ignored", () => {
    expect(
      read([
        'event: delta\ndata: {"type":"delta","text":"Hi"}\n\nevent: done\ndata: {"type":"done"}\n\n',
      ]),
    ).toEqual([{ type: "delta", text: "Hi" }, { type: "done" }]);
  });

  test("an event split across chunks waits for its end", () => {
    expect(read(['data: {"type":"de', 'lta","text":"a"}\n', "\n"])).toEqual([
      { type: "delta", text: "a" },
    ]);
  });

  test("CRLF line ends work, even split between chunks", () => {
    expect(read(['data: {"n":1}\r', "\n\r\n"])).toEqual([{ n: 1 }]);
  });

  test("keepalive comments and events without data are skipped", () => {
    expect(read([": keepalive\n\n", "event: ping\n\n", 'data: {"n":2}\n\n'])).toEqual([{ n: 2 }]);
  });

  test("multi-line data is joined with newlines", () => {
    expect(read(['data: {"a":\ndata: 1}\n\n'])).toEqual([{ a: 1 }]);
  });
});
