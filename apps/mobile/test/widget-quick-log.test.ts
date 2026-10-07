import { describe, expect, test } from "bun:test";
import type { WidgetCache } from "../src/features/widget/widget-cache";
import {
  afterLog,
  afterUndo,
  canUndo,
  lastLogText,
  UNDO_WINDOW_MS,
} from "../src/features/widget/widget-quick-log";

const cha = { label: "Cha", note: "cha", amountMinor: 2_000, categoryId: null };
const cache: WidgetCache = {
  signedIn: true,
  leftTodayMinor: 50_000,
  spentTodayMinor: 10_000,
  dailyMinor: 60_000,
  nextUp: null,
  topThree: { done: 0, total: 0 },
  habits: { done: 0, total: 0 },
  accountId: "cash",
  quick: [cha],
  status: null,
  lastLog: null,
  numerals: "latn",
  assistant: true,
  updatedAt: 0,
};

describe("widget quick-log undo", () => {
  test("a log moves today's numbers and can be undone for a while", () => {
    const logged = afterLog(cache, cha, { id: "t1", queued: false }, 1_000);
    expect(logged.leftTodayMinor).toBe(48_000);
    expect(logged.spentTodayMinor).toBe(12_000);
    expect(logged.lastLog).toEqual({
      id: "t1",
      label: "Cha",
      amountMinor: 2_000,
      at: 1_000,
      queued: false,
    });
    expect(canUndo(logged, 1_000 + UNDO_WINDOW_MS - 1)).toBe(true);
    expect(canUndo(logged, 1_000 + UNDO_WINDOW_MS)).toBe(false);
    expect(canUndo(cache, 1_000)).toBe(false);
  });

  test("undo puts the numbers back and says what was removed", () => {
    const undone = afterUndo(afterLog(cache, cha, { id: "t1", queued: true }, 0));
    expect(undone.leftTodayMinor).toBe(50_000);
    expect(undone.spentTodayMinor).toBe(10_000);
    expect(undone.lastLog).toBeNull();
    expect(undone.status).toBe("Removed Cha");
  });

  test("no budget stays no budget", () => {
    const noBudget = { ...cache, leftTodayMinor: null };
    expect(afterLog(noBudget, cha, { id: "t1", queued: false }, 0).leftTodayMinor).toBeNull();
  });

  test("the line beside Undo says whether it reached the server", () => {
    const log = { id: "t1", label: "Cha", amountMinor: 2_000, at: 0, queued: false };
    expect(lastLogText(log, "৳20")).toBe("Logged Cha ৳20");
    expect(lastLogText({ ...log, queued: true }, "৳20")).toBe("Saved Cha ৳20, syncs later");
  });
});
