import { describe, expect, test } from "bun:test";
import { comingUp, comingUpNet, topWithOther } from "../src/features/money/overview-data";

describe("topWithOther", () => {
  test("keeps the top five and sums the rest as Other", () => {
    const ranked: [string | null, number][] = [
      ["a", 600],
      ["b", 500],
      [null, 400],
      ["c", 300],
      ["d", 200],
      ["e", 100],
      ["f", 50],
    ];
    expect(topWithOther(ranked)).toEqual([
      { id: "a", amountMinor: 600 },
      { id: "b", amountMinor: 500 },
      { id: null, amountMinor: 400 },
      { id: "c", amountMinor: 300 },
      { id: "d", amountMinor: 200 },
      { id: null, amountMinor: 150, other: true },
    ]);
  });
  test("leaves Other out when nothing is left over", () => {
    expect(topWithOther([["a", 10]])).toEqual([{ id: "a", amountMinor: 10 }]);
    expect(topWithOther([])).toEqual([]);
  });
});

describe("comingUp", () => {
  const items = [
    { name: "Later", dueDate: "2026-11-20" },
    { name: "Week", dueDate: "2026-11-08" },
    { name: "Late", dueDate: "2026-10-28" },
    { name: "Today", dueDate: "2026-11-01" },
  ];
  test("keeps the next seven days and anything late, soonest first", () => {
    expect(comingUp(items, "2026-11-01").map((i) => i.name)).toEqual(["Late", "Today", "Week"]);
  });
});

describe("comingUpNet", () => {
  test("income adds, bills take away, other currencies stay out", () => {
    expect(
      comingUpNet(
        [
          { kind: "income", amountMinor: 4_500_000, currency: "BDT" },
          { kind: "bill", amountMinor: 105_000, currency: "BDT" },
          { kind: "bill", amountMinor: 999, currency: "USD" },
        ],
        "BDT",
      ),
    ).toBe(4_395_000);
  });
});
