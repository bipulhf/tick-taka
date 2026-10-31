import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "../src/dates";
import {
  isSureMoneyDraft,
  parseQuickAdd,
  type QuickAddContext,
  showQuickAddPickers,
} from "../src/quick-add";

const TZ = "Asia/Dhaka";
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, TZ);

const context: QuickAddContext = {
  now,
  timeZone: TZ,
  accounts: [
    { id: "acc_cash", name: "Cash", type: "cash" },
    { id: "acc_bkash", name: "bKash", type: "mobile_wallet" },
  ],
  defaultAccountId: "acc_cash",
  categories: [
    { id: "cat_food", name: "Food", kind: "expense", parentId: null },
    { id: "cat_salary", name: "Salary", kind: "income", parentId: null },
  ],
  areas: [],
  rules: [{ matchText: "netflix", categoryId: "cat_food", areaId: null }],
};

const sure = (text: string, ctx: QuickAddContext = context) =>
  isSureMoneyDraft(parseQuickAdd(text, ctx), ctx);

describe("quick-add is sure enough to hide its pickers", () => {
  test("an amount, a keyword category and the default account", () => {
    expect(sure("lunch 250")).toBe(true);
    expect(sure("cha 20")).toBe(true);
    expect(sure("+45000 salary")).toBe(true);
  });

  test("a learned rule counts as a category", () => {
    expect(sure("netflix 800")).toBe(true);
  });

  test("an account named in the text", () => {
    expect(sure("lunch 250 bkash")).toBe(true);
  });

  test("no category, no amount, or a second price keeps the pickers", () => {
    expect(sure("xyz 300")).toBe(false);
    expect(sure("250")).toBe(false);
    expect(sure("lunch 250, cha 20")).toBe(false);
  });

  test("tasks and time entries never collapse", () => {
    expect(sure("call bank tomorrow")).toBe(false);
    expect(sure("2h thesis")).toBe(false);
    expect(isSureMoneyDraft(null, context)).toBe(false);
  });

  test("no account left to log it to keeps the pickers", () => {
    const noAccounts = { ...context, accounts: [], defaultAccountId: null };
    expect(sure("lunch 250", noAccounts)).toBe(false);
  });

  test("an AI draft is sure only with a live account and a category of its kind", () => {
    const ai = {
      kind: "expense" as const,
      amountMinor: 25_000,
      accountId: "acc_cash",
      categoryId: "cat_food",
      areaId: null,
      note: "lunch",
      occurredAt: now,
      confidence: "high" as const,
    };
    expect(isSureMoneyDraft(ai, context)).toBe(true);
    expect(isSureMoneyDraft({ ...ai, categoryId: null }, context)).toBe(false);
    expect(isSureMoneyDraft({ ...ai, categoryId: "cat_salary" }, context)).toBe(false);
    expect(isSureMoneyDraft({ ...ai, accountId: "acc_gone" }, context)).toBe(false);
    expect(isSureMoneyDraft({ ...ai, confidence: "low" }, context)).toBe(false);
  });
});

describe("pickers stay once the person is using them", () => {
  test("a sure draft shows the summary until the person opens or picks", () => {
    expect(showQuickAddPickers({ sure: true, opened: false, picks: {} })).toBe(false);
    expect(showQuickAddPickers({ sure: true, opened: true, picks: {} })).toBe(true);
  });

  test("an AI answer that turns the draft sure after a pick doesn't fold them away", () => {
    expect(showQuickAddPickers({ sure: false, opened: false, picks: {} })).toBe(true);
    const picks = { accountId: "acc_bkash" };
    expect(showQuickAddPickers({ sure: true, opened: false, picks })).toBe(true);
  });

  test("a pick that was cleared doesn't count", () => {
    expect(
      showQuickAddPickers({ sure: true, opened: false, picks: { categoryId: undefined } }),
    ).toBe(false);
  });
});
