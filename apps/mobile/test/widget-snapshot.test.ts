import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  otherDays,
  todayTasks,
  widgetAssistant,
  widgetBills,
  widgetFocus,
  widgetHabits,
  widgetMoney,
  widgetMonth,
} from "../src/features/widget/widget-snapshot";
import { task as widgetTask } from "./helpers/widget-cache";

const TZ = "Asia/Dhaka";
const at = (day: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month: 11, day, hour, minute }, TZ);
const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: id,
  status: "open",
  doAt: null as number | null,
  hasTime: false,
  ...overrides,
});

describe("today's tasks for the widgets", () => {
  test("top three first, then the day in order, then evening; each task once", () => {
    const tasks = todayTasks({
      topThree: [task("slides", { status: "done" }), task("call")],
      timeline: [
        { kind: "bill" },
        { kind: "task", task: task("review", { doAt: at(1, 10), hasTime: true }) },
        { kind: "task", task: task("call") },
      ],
      evening: [task("read"), task("someday", { status: "someday" })],
    });
    expect(tasks.map((t) => t.id)).toEqual(["slides", "call", "review", "read"]);
    expect(tasks[0]).toMatchObject({ top: true, done: true });
    expect(tasks[2]).toMatchObject({ top: false, at: at(1, 10) });
    expect(tasks[3]?.at).toBeNull();
  });

  test("earlier days' open tasks oldest first, and how many wait for tomorrow", () => {
    const october = (day: number) =>
      zonedTimeToUtc({ year: 2026, month: 10, day, hour: 9, minute: 0 }, TZ);
    const { earlier, tomorrowCount } = otherDays(
      [
        task("fri", { doAt: october(30) }),
        task("thu", { doAt: october(29) }),
        task("today", { doAt: at(1, 9) }),
        task("tomorrow", { doAt: at(2, 9) }),
        task("sub", { doAt: october(29), parentId: "thu" }),
        task("after", { doAt: at(3, 9) }),
      ],
      "2026-11-01",
      TZ,
    );
    expect(earlier.map((t) => t.id)).toEqual(["thu", "fri"]);
    expect(tomorrowCount).toBe(1);
  });
});

test("habits keep today's count, target and streak", () => {
  expect(
    widgetHabits([
      {
        id: "h",
        name: "Water",
        emoji: "💧",
        todayCount: 5,
        targetCount: 8,
        streak: { current: 7 },
      },
    ]),
  ).toEqual([{ id: "h", name: "Water", emoji: "💧", count: 5, target: 8, streak: 7 }]);
});

describe("bills for the widget", () => {
  const item = (id: string, dueDate: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: id,
    kind: "bill",
    amountMinor: 100_000,
    currency: "BDT",
    accountId: null,
    nextDueAt: Date.parse(`${dueDate}T06:00:00Z`),
    dueDate,
    ...overrides,
  });

  test("overdue first, income only once it's due, and what's still to pay this month", () => {
    const { bills, billsLeftMinor } = widgetBills(
      [
        item("rent", "2026-11-03"),
        item("electricity", "2026-10-28"),
        item("internet", "2026-11-01"),
        item("salary", "2026-11-01", { kind: "income", amountMinor: 4_500_000 }),
        item("bonus", "2026-11-20", { kind: "income" }),
        item("insurance", "2026-12-05"),
        item("netflix", "2026-11-10", { currency: "USD" }),
      ],
      "2026-11-01",
      "BDT",
    );
    expect(bills.map((b) => b.id)).toEqual([
      "electricity",
      "internet",
      "salary",
      "rent",
      "netflix",
      "insurance",
    ]);
    expect(bills[0]?.overdue).toBe(true);
    expect(bills.find((b) => b.id === "salary")?.income).toBe(true);
    // Rent, electricity and internet; not December's insurance or the USD bill.
    expect(billsLeftMinor).toBe(300_000);
  });
});

describe("this month for the widget", () => {
  const budgets = {
    lines: [
      { parentId: null, name: "Food", emoji: "🍱", spentMinor: 610_000 },
      { parentId: "food", name: "Snacks", emoji: "🍿", spentMinor: 900_000 },
      { parentId: null, name: "Transport", emoji: "🛺", spentMinor: 120_000 },
    ],
    buckets: {
      flexible: { limitMinor: 1_000_000, spentMinor: 690_000 },
      fixed: { limitMinor: 0, spentMinor: 50_000 },
    },
  };
  const insights = { totals: { incomeMinor: 6_350_000, spentMinor: 1_007_000 } };

  test("in, out, budgets used and the top category", () => {
    expect(widgetMonth("2026-11", insights, budgets, null)).toEqual({
      month: "2026-11",
      inMinor: 6_350_000,
      outMinor: 1_007_000,
      budgetLimitMinor: 1_000_000,
      budgetSpentMinor: 690_000,
      top: { name: "Food", emoji: "🍱", amountMinor: 610_000 },
    });
  });

  test("keeps this month's numbers while loading, and drops last month's", () => {
    const kept = widgetMonth("2026-11", insights, budgets, null);
    expect(widgetMonth("2026-11", undefined, undefined, kept)).toBe(kept);
    expect(widgetMonth("2026-12", undefined, undefined, kept)).toBeNull();
  });
});

describe("focus for the widget", () => {
  const base = { minutes: 25, tasks: [widgetTask("t", { title: "Read paper" })], now: 1_000 };

  test("the server's running focus timer, ending a focus period after it started", () => {
    const focus = widgetFocus(
      { id: "e", startedAt: 0, source: "focus", taskId: "t" },
      { ...base, previous: null, fetchedAt: 500 },
    );
    expect(focus).toEqual({
      entryId: "e",
      startedAt: 0,
      endsAt: 25 * 60_000,
      taskId: "t",
      title: "Read paper",
    });
  });

  test("a session started on the widget after the fetch stands until it ends", () => {
    const started = { entryId: "w", startedAt: 900, endsAt: 5_000, taskId: null, title: null };
    expect(widgetFocus(null, { ...base, previous: started, fetchedAt: 500 })).toBe(started);
    expect(widgetFocus(null, { ...base, previous: started, fetchedAt: 950 })).toBeNull();
    // A tracking timer isn't a focus session.
    expect(
      widgetFocus(
        { id: "x", startedAt: 0, source: "timer", taskId: null },
        { ...base, previous: null, fetchedAt: 0 },
      ),
    ).toBeNull();
  });
});

test("Tiki is offered only when the server's AI and the chat are both on", () => {
  const status = (configured: boolean, assistant: boolean) => ({
    configured,
    features: { assistant },
  });
  expect(widgetAssistant(status(true, true), false)).toBe(true);
  expect(widgetAssistant(status(false, true), true)).toBe(false);
  expect(widgetAssistant(status(true, false), true)).toBe(false);
  // Not loaded yet: the last answer stands.
  expect(widgetAssistant(undefined, true)).toBe(true);
  expect(widgetAssistant(undefined, false)).toBe(false);
});

describe("widget money", () => {
  test("shows figures in the user's digits", () => {
    expect(widgetMoney({ numerals: "latn", hidden: false })(35_000)).toBe("৳350");
    expect(widgetMoney({ numerals: "beng", hidden: false })(35_000)).toBe("৳৩৫০");
  });

  test("Hide amounts masks every figure", () => {
    expect(widgetMoney({ numerals: "latn", hidden: true })(35_000)).toBe("৳•••");
  });
});
