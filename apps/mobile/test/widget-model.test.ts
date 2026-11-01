import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import type { WidgetBill } from "../src/features/widget/widget-cache";
import {
  billNote,
  billOrder,
  billTap,
  budgetShare,
  chipLabel,
  daysLeft,
  doneOf,
  earlierLabel,
  focusShare,
  focusTask,
  focusUntil,
  habitCaption,
  habitGrid,
  incomeDue,
  nextLabel,
  nextTask,
  taskListRows,
  todayRows,
} from "../src/features/widget/widget-model";
import { sampleCache, task } from "./helpers/widget-cache";

const TZ = "Asia/Dhaka";
const at = (month: number, day: number, hour: number) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute: 0 }, TZ);
const bill = (id: string, overrides: Partial<WidgetBill> = {}): WidgetBill => ({
  id,
  name: id,
  income: false,
  amountMinor: 105_000,
  currency: "BDT",
  accountId: null,
  dueDate: "2026-11-01",
  dueAt: at(11, 1, 9),
  overdue: false,
  thisMonth: true,
  ...overrides,
});

describe("Today widget", () => {
  const tasks = [
    task("email", { top: true, done: true, status: "done" }),
    task("slides", { top: true }),
    task("bank", { top: true }),
    task("review", { at: at(11, 1, 10) }),
    task("standup", { at: at(11, 1, 8) }),
    task("pay"),
  ];

  test("lists the top three as picked, ticked ones too", () => {
    expect(todayRows(tasks, 3).map((t) => t.id)).toEqual(["email", "slides", "bank"]);
    expect(todayRows(tasks, 2)).toHaveLength(2);
    expect(doneOf(tasks)).toEqual({ done: 1, total: 6 });
  });

  test("with no top three, lists the day's first open tasks", () => {
    const plain = tasks.map((t) => ({ ...t, top: false }));
    expect(todayRows(plain, 3).map((t) => t.id)).toEqual(["slides", "bank", "review"]);
  });

  test("Next is the next timed task not listed, a just-started one too, else the first open", () => {
    const listed = todayRows(tasks, 3);
    expect(nextTask(tasks, listed, at(11, 1, 8) + 10 * 60_000)?.id).toBe("standup");
    expect(nextTask(tasks, listed, at(11, 1, 9))?.id).toBe("review");
    expect(nextTask(tasks, listed, at(11, 1, 11))?.id).toBe("pay");
    expect(nextTask(tasks.slice(0, 3), listed, 0)).toBeNull();
    expect(nextLabel(task("r", { at: at(11, 1, 10) }), TZ)).toBe("Next · 10:00 am");
    expect(nextLabel(task("r"), TZ)).toBe("Next");
  });
});

describe("Tasks list widget", () => {
  test("earlier days first with their weekday, then today's with times", () => {
    const rows = taskListRows(
      sampleCache({
        earlier: [task("bank", { doAt: at(10, 29, 9) }), task("old", { doAt: at(10, 12, 9) })],
        tasks: [task("review", { at: at(11, 1, 10), doAt: at(11, 1, 10) }), task("pay")],
      }),
    );
    expect(
      rows.map((row) => (row.kind === "task" ? `${row.task.id} ${row.note}` : row.key)),
    ).toEqual(["earlier", "bank Thu", "old 12 Oct", "today", "review 10:00 am", "pay "]);
    expect(rows[0]).toMatchObject({ text: "Earlier · 2", tone: "earlier" });
    expect(rows[3]).toMatchObject({ text: "Today · 2", tone: "today" });
  });

  test("an empty day says so kindly, and no Earlier heading without earlier tasks", () => {
    const rows = taskListRows(sampleCache());
    expect(rows.map((row) => row.kind)).toEqual(["heading", "empty"]);
  });

  test("earlier labels never show a day more than a week old as a weekday", () => {
    expect(earlierLabel(task("x", { doAt: at(10, 26, 9) }), "2026-11-01", TZ)).toBe("Mon");
    expect(earlierLabel(task("x", { doAt: at(10, 25, 9) }), "2026-11-01", TZ)).toBe("25 Oct");
  });
});

describe("Bills widget", () => {
  test("overdue first, then by due date", () => {
    const bills = [
      bill("rent", { dueAt: 3 }),
      bill("net", { dueAt: 2 }),
      bill("power", { dueAt: 9, overdue: true }),
    ];
    expect([...bills].sort(billOrder).map((b) => b.id)).toEqual(["power", "net", "rent"]);
    expect(incomeDue([bill("rent"), bill("salary", { income: true })])?.id).toBe("salary");
  });

  test("each bill says when it's due and through which account", () => {
    const cache = sampleCache();
    const note = (b: WidgetBill) => billNote(b, "2026-11-01", cache.accounts, cache.accountId);
    expect(note(bill("power", { overdue: true, dueDate: "2026-10-28" }))).toBe(
      "Was due Wed 28 Oct",
    );
    expect(note(bill("net", { accountId: "bkash" }))).toBe("Due today · bKash");
    expect(note(bill("rent", { dueDate: "2026-11-03" }))).toBe("Tue 3 Nov · Cash");
    expect(note(bill("salary", { income: true }))).toBe("Today · Cash");
  });

  test("Paid uses the bill's account, else the default", () => {
    const cache = sampleCache();
    expect(billTap(bill("net", { accountId: "bkash" }), cache)).toEqual({
      kind: "pay",
      accountId: "bkash",
      remember: false,
    });
    expect(billTap(bill("rent"), cache)).toEqual({
      kind: "pay",
      accountId: "cash",
      remember: false,
    });
  });

  test("with no account to go by, Paid opens the bill's sheet to ask", () => {
    const noDefault = sampleCache({ accountId: null });
    expect(billTap(bill("rent"), noDefault)).toEqual({
      kind: "open",
      uri: "ticktaka://money/recurring/rent?pay=account",
    });
    expect(billTap(bill("rent"), sampleCache({ accountId: null, accounts: [] }))).toEqual({
      kind: "open",
      uri: "ticktaka://account/new",
    });
  });

  test("a bill in another currency opens its sheet for the rate", () => {
    expect(billTap(bill("netflix", { currency: "USD" }), sampleCache())).toEqual({
      kind: "open",
      uri: "ticktaka://money/recurring/netflix",
    });
  });
});

describe("small widgets", () => {
  test("days left count today, as in '30 days left' on 1 Nov", () => {
    expect(daysLeft("2026-11-01")).toBe(30);
    expect(daysLeft("2026-11-30")).toBe(1);
  });

  test("budgets used is a share, or nothing without budgets", () => {
    const month = {
      month: "2026-11",
      inMinor: 0,
      outMinor: 0,
      budgetLimitMinor: 1_000,
      budgetSpentMinor: 690,
      top: null,
    };
    expect(budgetShare(month)).toBeCloseTo(0.69);
    expect(budgetShare({ ...month, budgetLimitMinor: 0 })).toBeNull();
    expect(budgetShare(null)).toBeNull();
  });

  test("habit rings fit the widget's size", () => {
    expect(habitGrid(160, 160, 4)).toEqual({ columns: 2, shown: 2 });
    expect(habitGrid(160, 220, 4)).toEqual({ columns: 2, shown: 4 });
    expect(habitGrid(330, 160, 3)).toEqual({ columns: 4, shown: 3 });
  });

  test("focus shows its end time, not a ticking clock", () => {
    expect(focusUntil(at(11, 1, 15) + 45 * 60_000, TZ)).toBe("until 3:45 pm");
    expect(focusShare({ startedAt: 0, endsAt: 100 }, 25)).toBe(0.25);
    expect(focusShare({ startedAt: 0, endsAt: 100 }, 500)).toBe(1);
  });
});

test("quick-log chips read emoji, name and amount", () => {
  const entry = { label: "Cha", note: "cha", amountMinor: 2_000, categoryId: null };
  expect(chipLabel({ ...entry, emoji: "☕" }, "৳20")).toBe("☕ Cha ৳20");
  expect(chipLabel(entry, "৳20")).toBe("Cha ৳20");
});

test("habit rings say the count until full, then the streak", () => {
  const habit = { id: "h", name: "Water", emoji: "💧", count: 5, target: 8, streak: 7 };
  expect(habitCaption(habit)).toBe("5/8");
  expect(habitCaption({ ...habit, count: 8 })).toBe("🔥 7");
  expect(habitCaption({ ...habit, count: 8, streak: 0 })).toBe("Done");
});

test("focus from the widget is for an open top-three task, else any open one", () => {
  const done = task("done", { top: true, done: true });
  expect(focusTask([done, task("a"), task("b", { top: true })])?.id).toBe("b");
  expect(focusTask([done, task("a")])?.id).toBe("a");
  expect(focusTask([done])).toBeNull();
});
