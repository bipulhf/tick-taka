import { describe, expect, test } from "bun:test";
import { openDebtGroups, repaidShare, signedOutstanding } from "../src/features/money/debt-groups";
import { contributionSource, isFutureDeadline } from "../src/features/money/goal-money";

const accounts = [{ id: "cash" }, { id: "jar" }, { id: "bank" }];

describe("contributionSource", () => {
  test("uses the picked account", () => {
    expect(contributionSource("jar", "bank", accounts)).toBe("bank");
  });
  test("never moves money from the jar's own account into itself", () => {
    expect(contributionSource("jar", "jar", accounts)).toBe("cash");
    expect(contributionSource("cash", null, accounts)).toBe("jar");
  });
  test("a virtual jar takes the first account", () => {
    expect(contributionSource(null, null, accounts)).toBe("cash");
  });
  test("no other account means nowhere to move from", () => {
    expect(contributionSource("jar", null, [{ id: "jar" }])).toBeUndefined();
  });
});

describe("isFutureDeadline", () => {
  test("only a day after today counts", () => {
    expect(isFutureDeadline("2026-10-31", "2026-10-30")).toBe(true);
    expect(isFutureDeadline("2026-10-30", "2026-10-30")).toBe(false);
    expect(isFutureDeadline("2026-10-01", "2026-10-30")).toBe(false);
  });
});

describe("debts", () => {
  const debt = (direction: "owed_to_me" | "i_owe", closedAt: number | null = null) => ({
    direction,
    closedAt,
    outstandingMinor: 5000,
  });
  test("open loans split by direction, settled ones left out", () => {
    const groups = openDebtGroups([debt("owed_to_me"), debt("i_owe"), debt("i_owe", 1)]);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ["Owed to me", 1],
      ["I owe", 1],
    ]);
  });
  test("the sign says which way the money goes", () => {
    expect(signedOutstanding(debt("owed_to_me"))).toBe(5000);
    expect(signedOutstanding(debt("i_owe"))).toBe(-5000);
  });
  test("repaid share stays between 0 and 1", () => {
    expect(repaidShare(500, 2000)).toBe(0.25);
    expect(repaidShare(3000, 2000)).toBe(1);
    expect(repaidShare(0, 0)).toBe(0);
  });
});
