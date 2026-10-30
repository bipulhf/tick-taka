import { describe, expect, test } from "bun:test";
import { focusAnnouncement } from "../src/features/focus/focus-announcement";

const MIN = 60_000;
const keyAt = (ms: number, phase: "work" | "break" = "work") => focusAnnouncement(phase, ms)?.key;

describe("focus timer announcements", () => {
  test("nothing is announced without a session", () => {
    expect(focusAnnouncement(null, 25 * MIN)).toBeNull();
  });

  test("the key holds steady second to second inside a five-minute window", () => {
    const keys = new Set<string | undefined>();
    for (let ms = 25 * MIN; ms > 20 * MIN; ms -= 1000) keys.add(keyAt(ms));
    expect(keys.size).toBe(1);
  });

  test("a 25-minute session announces only at milestones", () => {
    const texts: string[] = [];
    let last: string | undefined;
    for (let ms = 25 * MIN; ms > 0; ms -= 1000) {
      const announcement = focusAnnouncement("work", ms)!;
      if (announcement.key !== last) texts.push(announcement.text);
      last = announcement.key;
    }
    expect(texts).toEqual([
      "Focus, 25 minutes left",
      "Focus, 20 minutes left",
      "Focus, 15 minutes left",
      "Focus, 10 minutes left",
      "Focus, 5 minutes left",
      "Focus, 1 minute left",
    ]);
  });

  test("a phase change is a milestone", () => {
    expect(keyAt(5 * MIN, "work")).not.toBe(keyAt(5 * MIN, "break"));
    expect(focusAnnouncement("break", 5 * MIN)?.text).toBe("Break, 5 minutes left");
  });
});
