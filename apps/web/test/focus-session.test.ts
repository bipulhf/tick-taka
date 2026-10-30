import { describe, expect, test } from "bun:test";
import {
  growthOf,
  hasEnded,
  parseSession,
  pause,
  REVIVE_WINDOW_MS,
  remainingMs,
  resume,
  startBreak,
  startWork,
  withVisibility,
} from "../src/features/focus/focus-session";

const MIN = 60_000;
const work = startWork(25 * MIN, "task", "entry", 0);

describe("focus session", () => {
  test("the clock counts down and the plant grows with it", () => {
    expect(remainingMs(work, 5 * MIN)).toBe(20 * MIN);
    expect(growthOf(work, 12.5 * MIN)).toBeCloseTo(0.5);
    expect(growthOf(null, 0)).toBe(0);
    expect(hasEnded(work, 25 * MIN)).toBe(true);
  });

  test("a pause freezes the clock and drops the server timer; a resume starts a new one", () => {
    const paused = pause(work, 10 * MIN);
    expect(paused.entryId).toBeNull();
    expect(remainingMs(paused, 60 * MIN)).toBe(15 * MIN);
    expect(hasEnded(paused, 60 * MIN)).toBe(false);
    const resumed = resume(paused, 60 * MIN, "entry-2");
    expect(resumed.endsAt).toBe(75 * MIN);
    expect(resumed.entryId).toBe("entry-2");
    // The plant keeps the growth from before the pause.
    expect(growthOf(resumed, 60 * MIN)).toBeCloseTo(0.4);
  });

  test("the break follows the work's planned end and keeps the plant grown", () => {
    const rest = startBreak(work, 5 * MIN, work.endsAt);
    expect(rest.phase).toBe("break");
    expect(rest.endsAt).toBe(30 * MIN);
    expect(rest.entryId).toBeNull();
    expect(growthOf(rest, 26 * MIN)).toBe(1);
  });

  test("hiding the tab droops the plant; coming back within a minute revives it", () => {
    const left = withVisibility(work, false, MIN);
    expect(left.drooping).toBe(true);
    expect(withVisibility(left, true, MIN + REVIVE_WINDOW_MS).drooping).toBe(false);
    expect(withVisibility(left, true, MIN + REVIVE_WINDOW_MS + 1).drooping).toBe(true);
  });

  test("a stored session is read back, and anything else is no session", () => {
    expect(parseSession(JSON.stringify(work))).toEqual(work);
    expect(parseSession("{nope")).toBeNull();
    expect(parseSession(JSON.stringify({ phase: "nap" }))).toBeNull();
    // Saved by the phone's shape, without the newer fields.
    const old = parseSession(JSON.stringify({ phase: "work", startedAt: 0, endsAt: 10 }));
    expect(old?.phaseMs).toBe(10);
    expect(old?.pausedRemainingMs).toBeNull();
  });
});
