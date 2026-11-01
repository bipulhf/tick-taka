import { describe, expect, test } from "bun:test";
import {
  cardsOwed,
  groupAccounts,
  shareOfTotal,
  totalIn,
} from "../src/features/money/account-groups";

const savings = { name: "Savings", type: "savings", currency: "BDT", balanceMinor: 60_000 };
const visa = { name: "Visa", type: "card", currency: "BDT", balanceMinor: -5_000 };
const wise = { name: "Wise", type: "bank", currency: "USD", balanceMinor: 99_999 };
const accounts = [
  { name: "Cash", type: "cash", currency: "BDT", balanceMinor: 30_000 },
  { name: "bKash", type: "mobile_wallet", currency: "BDT", balanceMinor: 10_000 },
  savings,
  visa,
  wise,
];

describe("account groups", () => {
  test("groups by type with each group's total in one currency", () => {
    expect(
      groupAccounts(accounts, "BDT").map((g) => [g.key, g.accounts.length, g.totalMinor]),
    ).toEqual([
      ["cash", 2, 40_000],
      ["bank", 2, 60_000],
      ["cards", 1, -5_000],
    ]);
  });
  test("net worth and what the cards owe", () => {
    expect(totalIn(accounts, "BDT")).toBe(95_000);
    expect(cardsOwed(accounts, "BDT")).toBe(5_000);
  });
  test("a share of the positive balances; none for debt or another currency", () => {
    expect(shareOfTotal(savings, accounts, "BDT")).toBe(0.6);
    expect(shareOfTotal(visa, accounts, "BDT")).toBeNull();
    expect(shareOfTotal(wise, accounts, "BDT")).toBeNull();
  });
});
