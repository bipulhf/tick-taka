import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "../src/dates";
import {
  describeDraft,
  type MoneyDraft,
  parseQuickAdd,
  type QuickAddContext,
  type TaskDraft,
  type TimeEntryDraft,
} from "../src/quick-add";

const TZ = "Asia/Dhaka";
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, TZ);
const context: QuickAddContext = {
  now,
  timeZone: TZ,
  accounts: [{ id: "acc_cash", name: "Cash", type: "cash" }],
  defaultAccountId: "acc_cash",
  categories: [{ id: "cat_food", name: "Food", kind: "expense", parentId: null }],
  areas: [{ id: "area_research", name: "Research" }],
};

const taka = (minor: number) => `৳${minor / 100}`;
const when = (ms: number, hasTime: boolean) => `${hasTime ? "at" : "on"} ${ms}`;
const preview = (draft: Parameters<typeof describeDraft>[0], names = {}) =>
  describeDraft(draft, names, taka, when);

const expense: MoneyDraft = {
  kind: "expense",
  amountMinor: 25_000,
  accountId: "acc_cash",
  categoryId: "cat_food",
  areaId: null,
  note: "",
  occurredAt: now,
  confidence: "high",
};
const task: TaskDraft = {
  kind: "task",
  title: "Call bank",
  doAt: null,
  hasTime: false,
  reminderAt: null,
  deadlineAt: null,
  rrule: null,
  whenSlot: "day",
  status: "inbox",
  priority: "normal",
  areaId: null,
  confidence: "high",
};
const timeEntry: TimeEntryDraft = {
  kind: "time_entry",
  minutes: 90,
  note: "",
  areaId: "area_research",
  startedAt: now - 90 * 60_000,
  endedAt: now,
  confidence: "high",
};

// QA-406 / CQ-042: the one-line preview shown above Save.
describe("describeDraft", () => {
  test("an expense names its amount, category and account", () => {
    expect(preview(expense, { category: "Food", account: "Cash" })).toBe(
      "Expense ৳250 · Food · Cash",
    );
  });

  test("income with no amount yet, and a note", () => {
    expect(preview({ ...expense, kind: "income", amountMinor: null, note: "bonus" })).toBe(
      "Income — · “bonus”",
    );
  });

  test("a someday task says Someday, never a date", () => {
    expect(preview({ ...task, status: "someday", doAt: now })).toBe("Task “Call bank” · Someday");
  });

  test("an evening task with a time, a repeat and an area", () => {
    expect(
      preview(
        { ...task, doAt: now, hasTime: true, whenSlot: "evening", rrule: "FREQ=DAILY" },
        { area: "Research" },
      ),
    ).toBe(`Task “Call bank” · at ${now} · Evening · Repeats · Research`);
  });

  test("a time entry in hours and minutes, with its area and note", () => {
    expect(preview({ ...timeEntry, note: "paper" }, { area: "Research" })).toBe(
      "Time 1h30m · Research · “paper”",
    );
    expect(preview({ ...timeEntry, minutes: 45 })).toBe("Time 45m");
    expect(preview({ ...timeEntry, minutes: 120 })).toBe("Time 2h");
  });
});

describe("a time entry chosen with the type chip", () => {
  test("takes its duration from the text", () => {
    expect(parseQuickAdd("1h 30m research", context, "time_entry")).toMatchObject({
      kind: "time_entry",
      minutes: 90,
      note: "research",
      areaId: "area_research",
      startedAt: now - 90 * 60_000,
    });
  });

  test("without a duration it is a zero-minute draft, low confidence, to fill in", () => {
    expect(parseQuickAdd("research notes", context, "time_entry")).toEqual({
      kind: "time_entry",
      minutes: 0,
      note: "research notes",
      areaId: "area_research",
      startedAt: now,
      endedAt: now,
      confidence: "low",
    });
  });
});
