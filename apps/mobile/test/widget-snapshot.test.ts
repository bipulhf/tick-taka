import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { widgetSnapshot } from "../src/features/widget/widget-snapshot";
import type { TodayData } from "../src/lib/queries";

const TZ = "Asia/Dhaka";
const at = (hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour, minute }, TZ);
const task = (title: string, status = "open") => ({ title, status }) as never;

function today(overrides: Partial<Record<keyof TodayData, unknown>> = {}): TodayData {
  return {
    safeToSpend: {
      hasBudgets: true,
      leftTodayMinor: 33_700,
      spentTodayMinor: 35_000,
      dailyMinor: 68_700,
    },
    topThree: [task("Draft"), task("Slides"), task("Review PR", "done")],
    habits: [{ doneToday: true }, { doneToday: false }],
    timeline: [],
    ...overrides,
  } as unknown as TodayData;
}

describe("widget snapshot", () => {
  test("money, top three and habits in a few numbers", () => {
    const snap = widgetSnapshot(today(), at(18), TZ);
    expect(snap).toMatchObject({
      leftTodayMinor: 33_700,
      spentTodayMinor: 35_000,
      dailyMinor: 68_700,
      topThree: { done: 1, total: 3 },
      habits: { done: 1, total: 2 },
    });
  });

  test("next up is the next timed task, then an open top-three task", () => {
    const timeline = [
      { kind: "task", at: at(9), task: task("Earlier, missed") },
      { kind: "task", at: at(21), task: task("Call Ammu") },
      { kind: "task", at: at(20), task: task("Standup") },
      { kind: "task", at: at(19), task: task("Done already", "done") },
    ];
    expect(widgetSnapshot(today({ timeline }), at(18), TZ).nextUp).toEqual({
      title: "Standup",
      when: "8:00 pm",
    });
    expect(widgetSnapshot(today(), at(18), TZ).nextUp).toEqual({
      title: "Draft",
      when: "Top three",
    });
  });

  test("no budgets means no daily number", () => {
    const snap = widgetSnapshot(
      today({
        safeToSpend: { hasBudgets: false, leftTodayMinor: 0, spentTodayMinor: 0, dailyMinor: 0 },
      }),
      at(18),
      TZ,
    );
    expect(snap.leftTodayMinor).toBeNull();
  });
});
