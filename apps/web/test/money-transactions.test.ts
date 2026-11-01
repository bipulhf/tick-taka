import { describe, expect, test } from "bun:test";
import { endOfLocalDay, localMonthRange, startOfLocalDay } from "@tick-taka/shared/dates";
import {
  amountText,
  isSum,
  readAmount,
  readPositiveAmount,
} from "../src/features/money/amount-text";
import { transactionAmount } from "../src/features/money/transaction-amount";
import {
  categoryOptions,
  filtersToQuery,
  groupByDay,
  isFiltered,
  recentMonths,
  validateTransactionSearch,
} from "../src/features/money/transaction-filters";
import {
  draftFromPreset,
  draftFromTransaction,
  fieldErrors,
  formFromDraft,
  formSchema,
  transactionBody,
} from "../src/features/money/transaction-form";
import { dayNet, summarizeTransactions } from "../src/features/money/transaction-summary";

const TZ = "Asia/Dhaka";
const bdt = () => "BDT";

describe("readAmount", () => {
  test("reads plain amounts, digits and currency signs", () => {
    expect(readAmount("1,250.50")).toBe(125050);
    expect(readAmount("৳ 60")).toBe(6000);
    expect(readAmount("২৫০")).toBe(25000);
  });
  test("works out sums like the phone keypad", () => {
    expect(readAmount("120+45")).toBe(16500);
    expect(readAmount("1850/3")).toBe(61700);
    expect(isSum("1850/3")).toBe(true);
    expect(isSum("-50")).toBe(false);
  });
  test("refuses what isn't a number", () => {
    expect(readAmount("")).toBeNull();
    expect(readAmount("lunch")).toBeNull();
    expect(readPositiveAmount("0")).toBeNull();
    expect(readPositiveAmount("5-10")).toBeNull();
  });
  test("starting text for a stored amount", () => {
    expect(amountText(125050)).toBe("1250.5");
    expect(amountText(0)).toBe("");
    expect(amountText(null)).toBe("");
  });
});

describe("transactionAmount", () => {
  test("money out has a minus, money in a plus", () => {
    expect(transactionAmount({ type: "expense", amountMinor: 12000 })).toMatchObject({
      minor: -12000,
      signed: false,
      tone: "coral",
    });
    expect(transactionAmount({ type: "income", amountMinor: 500 })).toMatchObject({
      minor: 500,
      signed: true,
      tone: "mint",
    });
  });
  test("a transfer seen from the receiving account arrives with a plus", () => {
    const tx = { type: "transfer", amountMinor: 1000, toAmountMinor: 900, toAccountId: "b" };
    expect(transactionAmount(tx).transfer).toBe(true);
    expect(transactionAmount(tx, "b")).toMatchObject({ minor: 900, signed: true });
    expect(transactionAmount(tx, "a")).toMatchObject({ minor: -1000, signed: false });
  });
});

describe("transaction form", () => {
  test("a preset fills a new transaction", () => {
    const preset = new URLSearchParams(
      "type=income&amountMinor=45000&note=tuition&accountId=bk&occurredAt=1793329200000",
    );
    const draft = draftFromPreset(preset, { accountId: "cash", now: 1 }, bdt);
    expect(draft).toMatchObject({
      type: "income",
      amount: "450",
      note: "tuition",
      accountId: "bk",
      occurredAt: 1793329200000,
      toAccountId: null,
    });
  });
  test("an empty or odd preset falls back to an expense now", () => {
    const draft = draftFromPreset(
      new URLSearchParams("type=adjustment&amountMinor=x"),
      { accountId: "cash", now: 42 },
      bdt,
    );
    expect(draft).toMatchObject({ type: "expense", amount: "", accountId: "cash", occurredAt: 42 });
  });
  test("checks an amount and a transfer's second account", () => {
    const draft = draftFromPreset(
      new URLSearchParams("type=transfer"),
      { accountId: "a", now: 1 },
      bdt,
    );
    const result = formSchema.safeParse(formFromDraft(draft, { from: "BDT", to: "BDT" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(errors.amountMinor).toBe("Enter an amount");
    expect(errors.toAccountId).toBe("Pick a different account to move money to");
  });
  test("sends what the phone sends", () => {
    const stored = {
      type: "transfer" as const,
      amountMinor: 100000,
      toAmountMinor: 800,
      feeMinor: 1850,
      accountId: "a",
      toAccountId: "b",
      categoryId: "food",
      areaId: null,
      eventId: null,
      note: "  ",
      occurredAt: 5,
      receiptPath: null,
    };
    const draft = draftFromTransaction(stored, (id) => (id === "b" ? "USD" : "BDT"));
    expect(draft.fee).toBe("18.5");
    const form = formFromDraft({ ...draft, amount: "500+500" }, { from: "BDT", to: "USD" });
    const body = transactionBody(form, { crossCurrency: false });
    expect(body).toMatchObject({
      amountMinor: 100000,
      toAmountMinor: null,
      feeMinor: 1850,
      categoryId: null,
      note: null,
    });
    expect(transactionBody(form, { crossCurrency: true }).toAmountMinor).toBe(800);
  });
  test("a balance check keeps its signed amount", () => {
    const stored = {
      type: "adjustment" as const,
      amountMinor: -2500,
      toAmountMinor: null,
      feeMinor: 0,
      accountId: "a",
      toAccountId: null,
      categoryId: null,
      areaId: null,
      eventId: null,
      note: null,
      occurredAt: 5,
      receiptPath: null,
    };
    const form = formFromDraft(
      draftFromTransaction(stored, bdt),
      { from: "BDT", to: "BDT" },
      -2500,
    );
    expect(formSchema.safeParse(form).success).toBe(true);
    expect(
      transactionBody(form, { crossCurrency: false, adjustmentMinor: -2500 }).amountMinor,
    ).toBe(-2500);
  });
});

describe("transaction filters", () => {
  test("reads the URL and keeps the panel keys", () => {
    expect(
      validateTransactionSearch({
        accountId: "a",
        type: "transfer",
        month: "2026-10",
        panel: "transaction:new",
        q: " ",
      }),
    ).toMatchObject({
      accountId: "a",
      type: "transfer",
      month: "2026-10",
      panel: "transaction:new",
      q: undefined,
    });
    expect(validateTransactionSearch({ type: "loan", month: "Oct" })).toMatchObject({
      type: undefined,
      month: undefined,
    });
  });
  test("a month becomes its range in the user's zone", () => {
    const range = localMonthRange("2026-10", TZ);
    expect(filtersToQuery({ month: "2026-10", q: " cha " }, TZ)).toEqual({
      q: "cha",
      from: String(range.from),
      to: String(range.to),
    });
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ eventId: "e" })).toBe(true);
  });
  test("the month view and a picked day come from the URL", () => {
    expect(validateTransactionSearch({ view: "month", day: "2026-10-12" })).toMatchObject({
      view: "month",
      day: "2026-10-12",
    });
    expect(validateTransactionSearch({ view: "grid", day: "12 Oct" })).toMatchObject({
      view: undefined,
      day: undefined,
    });
  });
  test("a day becomes its own range and wins over its month", () => {
    expect(filtersToQuery({ month: "2026-10", day: "2026-10-12" }, TZ)).toEqual({
      from: String(startOfLocalDay("2026-10-12", TZ)),
      to: String(endOfLocalDay("2026-10-12", TZ)),
    });
    expect(isFiltered({ day: "2026-10-12" })).toBe(true);
  });
  test("groups by local day, newest first", () => {
    const at = (iso: string) => Date.parse(iso);
    const days = groupByDay(
      [
        { id: 1, occurredAt: at("2026-10-30T18:30:00Z") }, // 31 Oct in Dhaka
        { id: 2, occurredAt: at("2026-10-30T10:00:00Z") },
        { id: 3, occurredAt: at("2026-10-30T03:00:00Z") },
        { id: 4, occurredAt: at("2026-10-29T12:00:00Z") },
      ],
      TZ,
    );
    expect(days.map((d) => [d.date, d.items.map((i) => i.id)])).toEqual([
      ["2026-10-31", [1]],
      ["2026-10-30", [2, 3]],
      ["2026-10-29", [4]],
    ]);
  });
  test("months back from this one", () => {
    expect(recentMonths("2026-02", 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
  });
  test("categories list each parent before its children", () => {
    const cats = [
      { id: "eat", name: "Eating out", emoji: "🍽️", kind: "expense", parentId: "food" },
      { id: "food", name: "Food", emoji: "🍛", kind: "expense", parentId: null },
      { id: "pay", name: "Salary", emoji: "💼", kind: "income", parentId: null },
    ];
    expect(categoryOptions(cats, "expense").map((o) => [o.value, o.hint])).toEqual([
      ["food", undefined],
      ["eat", "Food"],
    ]);
    expect(categoryOptions(cats)).toHaveLength(3);
  });
});

describe("summarizeTransactions and dayNet", () => {
  const items = [
    { type: "expense", amountMinor: 12_000, accountId: "cash" },
    { type: "income", amountMinor: 4_500_000, accountId: "bank" },
    { type: "transfer", amountMinor: 50_000, accountId: "bank", toAccountId: "cash" },
    { type: "expense", amountMinor: 999, accountId: "usd" },
  ];
  const inBdt = (item: { accountId: string | null }) => item.accountId !== "usd";
  test("adds up spent and earned in one currency, and counts everything", () => {
    expect(summarizeTransactions(items, inBdt)).toEqual({
      spentMinor: 12_000,
      earnedMinor: 4_500_000,
      netMinor: 4_488_000,
      count: 4,
    });
  });
  test("a day's net leaves transfers out, unless seen from one account", () => {
    expect(dayNet(items, inBdt)).toBe(4_488_000);
    expect(dayNet(items, inBdt, "cash")).toBe(4_538_000);
  });
});
