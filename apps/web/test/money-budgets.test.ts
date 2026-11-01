import { describe, expect, test } from "bun:test";
import {
  bucketLines,
  bucketShown,
  byCloseness,
  editorLines,
  editorPayload,
  editorTotal,
  keptLines,
  lineProgress,
  noBudgets,
  paceMark,
  parseSuggested,
  withoutLine,
} from "../src/features/money/budget-lines";
import { validateBudgetsSearch } from "../src/features/money/budgets-search";

const line = (over: Partial<Parameters<typeof lineProgress>[0]> = {}) => ({
  categoryId: "food",
  parentId: null as string | null,
  budgetType: "flexible",
  hasBudget: true,
  limitMinor: 400_000,
  rollover: false,
  carriedMinor: 0,
  spentMinor: 100_000,
  availableMinor: 300_000,
  ...over,
});

describe("budget lines", () => {
  test("a bucket shows budgeted or spent lines, sub-categories only with a budget", () => {
    const lines = [
      line(),
      line({ categoryId: "fun", hasBudget: false, spentMinor: 0 }),
      line({ categoryId: "health", hasBudget: false, spentMinor: 65_000 }),
      line({ categoryId: "eating", parentId: "food", hasBudget: false, spentMinor: 9_000 }),
      line({ categoryId: "groceries", parentId: "food" }),
      line({ categoryId: "rent", budgetType: "fixed" }),
    ];
    expect(bucketLines(lines, "flexible").map((l) => l.categoryId)).toEqual([
      "food",
      "health",
      "groceries",
    ]);
    expect(bucketLines(lines, "fixed").map((l) => l.categoryId)).toEqual(["rent"]);
  });

  test("an empty bucket is hidden and an empty month is the empty state", () => {
    expect(bucketShown({ limitMinor: 0, spentMinor: 0 }, [])).toBe(false);
    expect(bucketShown({ limitMinor: 100, spentMinor: 0 }, [])).toBe(true);
    expect(noBudgets([line({ hasBudget: false, spentMinor: 0 })])).toBe(true);
    expect(noBudgets([line({ hasBudget: false, spentMinor: 1 })])).toBe(false);
  });

  test("progress counts what rolled over and is full without room", () => {
    expect(lineProgress(line({ carriedMinor: 100_000 }))).toBe(0.2);
    expect(lineProgress(line({ limitMinor: 0 }))).toBe(1);
  });

  test("deleting a line re-sends the rest of the month", () => {
    const lines = [
      line(),
      line({ categoryId: "rent", rollover: true }),
      line({ categoryId: "x", hasBudget: false }),
    ];
    expect(keptLines(lines)).toHaveLength(2);
    expect(withoutLine(lines, "food")).toEqual([
      { categoryId: "rent", limitMinor: 400_000, rollover: true },
    ]);
  });
});

describe("budget editor", () => {
  test("starts from saved limits, with suggestions winning", () => {
    const lines = [line(), line({ categoryId: "fun", hasBudget: false, limitMinor: 0 })];
    expect(editorLines(lines)).toEqual({
      food: { limit: "4000", rollover: false },
      fun: { limit: "", rollover: false },
    });
    expect(editorLines(lines, { fun: 150_000 }).fun).toEqual({ limit: "1500", rollover: false });
  });

  test("sends every limit above zero, sums included", () => {
    const payload = editorPayload({
      food: { limit: "4000", rollover: true },
      fun: { limit: "1000+500", rollover: false },
      health: { limit: "", rollover: true },
      bad: { limit: "abc", rollover: false },
    });
    expect(payload).toEqual([
      { categoryId: "food", limitMinor: 400_000, rollover: true },
      { categoryId: "fun", limitMinor: 150_000, rollover: false },
    ]);
    expect(
      editorTotal({ a: { limit: "10", rollover: false }, b: { limit: "২০", rollover: false } }),
    ).toBe(3_000);
  });

  test("reads the panel's suggested preset safely", () => {
    expect(parseSuggested('{"food":400000,"bad":-1,"x":"2"}')).toEqual({ food: 400_000 });
    expect(parseSuggested("[1]")).toBeUndefined();
    expect(parseSuggested("{oops")).toBeUndefined();
    expect(parseSuggested(null)).toBeUndefined();
  });
});

describe("budgets search", () => {
  test("keeps a real month to plan and drops anything else", () => {
    expect(validateBudgetsSearch({ plan: "2026-11" })).toMatchObject({ plan: "2026-11" });
    expect(validateBudgetsSearch({ plan: "2026-13" }).plan).toBeUndefined();
    expect(validateBudgetsSearch({ plan: 5 }).plan).toBeUndefined();
    expect(validateBudgetsSearch({ panel: "budget:2026-11" })).toMatchObject({
      panel: "budget:2026-11",
    });
  });
});

describe("budgets search: split my pay", () => {
  test("opens the split, with a whole positive amount only", () => {
    expect(validateBudgetsSearch({ split: true, amount: 4_500_000 })).toMatchObject({
      split: true,
      amount: 4_500_000,
    });
    expect(validateBudgetsSearch({ split: "true" }).split).toBe(true);
    expect(validateBudgetsSearch({ split: true, amount: -5 }).amount).toBeUndefined();
    expect(validateBudgetsSearch({ split: true, amount: 1.5 }).amount).toBeUndefined();
    // An amount without the split means nothing.
    expect(validateBudgetsSearch({ amount: 4_500_000 })).toMatchObject({
      split: undefined,
      amount: undefined,
    });
  });
});

describe("byCloseness and paceMark", () => {
  const line = (
    categoryId: string,
    hasBudget: boolean,
    limitMinor: number,
    spentMinor: number,
  ) => ({
    categoryId,
    parentId: null,
    budgetType: "flexible",
    hasBudget,
    limitMinor,
    rollover: false,
    carriedMinor: 0,
    spentMinor,
    availableMinor: limitMinor - spentMinor,
  });
  test("over-limit and nearly-full lines lead; unbudgeted spending goes last", () => {
    const lines = [
      line("calm", true, 1000, 100),
      line("loose", false, 0, 50),
      line("over", true, 1000, 1200),
      line("loose-big", false, 0, 500),
      line("near", true, 1000, 900),
    ];
    expect(byCloseness(lines).map((l) => l.categoryId)).toEqual([
      "over",
      "near",
      "calm",
      "loose-big",
      "loose",
    ]);
  });
  test("pace mark is today's place in this month only", () => {
    expect(paceMark("2026-11-15", "2026-11")).toBe(0.5);
    expect(paceMark("2026-11-15", "2026-10")).toBeUndefined();
  });
});
