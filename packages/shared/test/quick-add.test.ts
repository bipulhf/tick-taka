import { describe, expect, test } from "bun:test";
import { startOfLocalDay, toLocalDate, zonedTimeToUtc } from "../src/dates";
import { parseQuickAdd, type QuickAddContext } from "../src/quick-add";

const TZ = "Asia/Dhaka";
// Sunday 4 October 2026, 10:00 in Dhaka
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, TZ);

const context: QuickAddContext = {
  now,
  timeZone: TZ,
  accounts: [
    { id: "acc_cash", name: "Cash", type: "cash" },
    { id: "acc_bkash", name: "bKash", type: "mobile_wallet" },
    { id: "acc_bank", name: "City Bank", type: "bank" },
  ],
  defaultAccountId: "acc_cash",
  categories: [
    { id: "cat_food", name: "Food", kind: "expense", parentId: null },
    { id: "cat_eatout", name: "Eating out", kind: "expense", parentId: "cat_food" },
    { id: "cat_transport", name: "Transport", kind: "expense", parentId: null },
    { id: "cat_shopping", name: "Shopping", kind: "expense", parentId: null },
    { id: "cat_salary", name: "Salary", kind: "income", parentId: null },
  ],
  areas: [
    { id: "area_research", name: "Research" },
    { id: "area_teaching", name: "Teaching" },
  ],
  rules: [],
};

describe("quick-add parser (spec examples)", () => {
  test("lunch 250 → expense ৳250 in Food from default account", () => {
    expect(parseQuickAdd("lunch 250", context)).toMatchObject({
      kind: "expense",
      amountMinor: 25_000,
      categoryId: "cat_food",
      accountId: "acc_cash",
      note: "lunch",
      confidence: "high",
    });
  });

  test("+45000 salary → income ৳45,000", () => {
    expect(parseQuickAdd("+45000 salary", context)).toMatchObject({
      kind: "income",
      amountMinor: 4_500_000,
      categoryId: "cat_salary",
    });
  });

  test("call bank tomorrow 5pm → task due tomorrow with a 5 pm reminder", () => {
    const draft = parseQuickAdd("call bank tomorrow 5pm", context);
    const fivePm = zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 17 }, TZ);
    expect(draft).toMatchObject({
      kind: "task",
      title: "Call bank",
      doAt: fivePm,
      hasTime: true,
      reminderAt: fivePm,
    });
  });

  test("2h thesis writing → 2 hour time entry under Research", () => {
    expect(parseQuickAdd("2h thesis writing", context)).toMatchObject({
      kind: "time_entry",
      minutes: 120,
      areaId: "area_research",
      note: "thesis writing",
      endedAt: now,
    });
  });

  test("rickshaw 60 bkash → expense ৳60 in Transport from bKash", () => {
    expect(parseQuickAdd("rickshaw 60 bkash", context)).toMatchObject({
      kind: "expense",
      amountMinor: 6_000,
      categoryId: "cat_transport",
      accountId: "acc_bkash",
      note: "rickshaw",
    });
  });
});

describe("quick-add parser (more cases)", () => {
  test("calculator keypad in amount", () => {
    expect(parseQuickAdd("dinner 1850/3", context)).toMatchObject({
      amountMinor: 61_667,
      categoryId: "cat_food",
    });
  });

  test("learned rules win over keywords", () => {
    const withRule = {
      ...context,
      rules: [{ matchText: "foodpanda", categoryId: "cat_food", areaId: null }],
    };
    expect(parseQuickAdd("foodpanda 540", withRule)).toMatchObject({ categoryId: "cat_food" });
  });

  test("child category keyword", () => {
    expect(parseQuickAdd("restaurant 900", context)).toMatchObject({ categoryId: "cat_eatout" });
  });

  test("unknown category is low confidence", () => {
    expect(parseQuickAdd("zxcv 120", context)).toMatchObject({
      kind: "expense",
      categoryId: null,
      confidence: "low",
    });
  });

  test("yesterday moves the date", () => {
    const draft = parseQuickAdd("lunch 250 yesterday", context);
    expect(draft?.kind).toBe("expense");
    if (draft?.kind === "expense") expect(toLocalDate(draft.occurredAt, TZ)).toBe("2026-10-03");
  });

  test("recurring task with plain words", () => {
    const draft = parseQuickAdd("lab class every Sun and Tue 10am", context);
    expect(draft).toMatchObject({
      kind: "task",
      title: "Lab class",
      rrule: "FREQ=WEEKLY;BYDAY=SU,TU;BYHOUR=10;BYMINUTE=0",
      hasTime: true,
      areaId: "area_teaching",
    });
    if (draft?.kind === "task") expect(draft.doAt).toBe(now);
  });

  test("deadline vs do date", () => {
    const draft = parseQuickAdd("paper revision tuesday by Oct 30", context);
    expect(draft?.kind).toBe("task");
    if (draft?.kind === "task") {
      expect(draft.title).toBe("Paper revision");
      expect(draft.doAt).toBe(startOfLocalDay("2026-10-06", TZ));
      expect(toLocalDate(draft.deadlineAt ?? 0, TZ)).toBe("2026-10-30");
    }
  });

  test("evening, someday and priority", () => {
    expect(parseQuickAdd("reply to students this evening", context)).toMatchObject({
      whenSlot: "evening",
      title: "Reply to students",
    });
    expect(parseQuickAdd("learn Rust someday", context)).toMatchObject({
      status: "someday",
      doAt: null,
    });
    expect(parseQuickAdd("submit grades !!", context)).toMatchObject({
      priority: "high",
      title: "Submit grades",
    });
  });

  test("forced kinds from chips", () => {
    expect(parseQuickAdd("uber home", context, "expense")).toMatchObject({
      kind: "expense",
      amountMinor: null,
      confidence: "low",
    });
    expect(parseQuickAdd("lunch 250", context, "task")).toMatchObject({ kind: "task" });
    expect(parseQuickAdd("45m reading", context)).toMatchObject({
      kind: "time_entry",
      minutes: 45,
    });
    expect(parseQuickAdd("1h30m grading", context)).toMatchObject({
      kind: "time_entry",
      minutes: 90,
      areaId: "area_teaching",
    });
  });

  test("plain task text", () => {
    expect(parseQuickAdd("refresh portfolio", context)).toMatchObject({
      kind: "task",
      doAt: null,
      confidence: "high",
    });
    expect(parseQuickAdd("   ", context)).toBeNull();
  });
});
