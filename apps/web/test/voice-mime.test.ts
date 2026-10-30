import { expect, test } from "bun:test";
import { pickVoiceMime, sendMimeOf } from "../src/features/assistant/voice-mime";

test("Chrome and Firefox record Opus in WebM, sent as audio/webm", () => {
  expect(pickVoiceMime((type) => type.startsWith("audio/webm"))).toEqual({
    record: "audio/webm;codecs=opus",
    send: "audio/webm",
  });
});

test("Safari records MP4", () => {
  expect(pickVoiceMime((type) => type === "audio/mp4")?.send).toBe("audio/mp4");
});

test("no format the server accepts means no microphone", () => {
  expect(pickVoiceMime(() => false)).toBeNull();
});

test("what the recorder made is named without its codec", () => {
  expect(sendMimeOf("audio/webm;codecs=opus", "audio/mp4")).toBe("audio/webm");
  expect(sendMimeOf("audio/ogg", "audio/webm")).toBe("audio/webm");
});
