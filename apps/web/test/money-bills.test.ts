import { describe, expect, test } from "bun:test";
import {
  billGroupOf,
  billPill,
  datesDueThisMonth,
  groupBills,
  groupTotal,
  monthAhead,
  settledThisMonth,
} from "../src/features/money/bill-groups";

const today = "2026-11-01";
const monthly = "FREQ=MONTHLY;BYMONTHDAY=5";

describe("bill groups", () => {
  test("late, the next 7 days, later this month, next month, later", () => {
    expect(billGroupOf("2026-10-28", today)).toBe("overdue");
    expect(billGroupOf("2026-11-01", today)).toBe("week");
    expect(billGroupOf("2026-11-07", today)).toBe("week");
    expect(billGroupOf("2026-11-08", today)).toBe("month");
    expect(billGroupOf("2026-12-31", today)).toBe("next");
    expect(billGroupOf("2027-01-01", today)).toBe("later");
  });
  test("groups soonest first and leaves out empty ones", () => {
    const groups = groupBills(
      [{ dueDate: "2026-11-20" }, { dueDate: "2026-10-30" }, { dueDate: "2026-11-09" }],
      today,
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.dueDate)])).toEqual([
      ["overdue", ["2026-10-30"]],
      ["month", ["2026-11-09", "2026-11-20"]],
    ]);
  });
  test("a group's total leaves other currencies out", () => {
    expect(
      groupTotal(
        [
          { amountMinor: 100, currency: "BDT" },
          { amountMinor: 5, currency: "USD" },
        ],
        "BDT",
      ),
    ).toBe(100);
  });
});

describe("this month", () => {
  test("a monthly bill counts once, a weekly one each time, next month's not at all", () => {
    expect(datesDueThisMonth({ rrule: monthly, dueDate: "2026-11-03" }, today)).toEqual([
      "2026-11-03",
    ]);
    expect(
      datesDueThisMonth({ rrule: "FREQ=WEEKLY;BYDAY=MO", dueDate: "2026-11-16" }, today),
    ).toEqual(["2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(datesDueThisMonth({ rrule: monthly, dueDate: "2026-12-05" }, today)).toEqual([]);
  });
  test("still to pay and expected income, late ones included", () => {
    const item = (kind: string, amountMinor: number, dueDate: string, currency = "BDT") => ({
      kind,
      amountMinor,
      currency,
      rrule: monthly,
      dueDate,
    });
    expect(
      monthAhead(
        [
          item("bill", 1000, "2026-10-28"),
          item("bill", 500, "2026-11-20"),
          item("bill", 700, "2026-12-01"),
          item("bill", 9, "2026-11-02", "USD"),
          item("income", 4000, "2026-11-01"),
        ],
        today,
        "BDT",
      ),
    ).toEqual({ stillToPayMinor: 1500, billsLeft: 2, expectedMinor: 4000, incomeLeft: 1 });
  });
  test("paid and received come from the month's transactions with a recurring id", () => {
    const settled = settledThisMonth(
      [
        { recurringId: "gym", type: "expense", amountMinor: 1500, usd: false },
        { recurringId: null, type: "expense", amountMinor: 99, usd: false },
        { recurringId: "pay", type: "income", amountMinor: 4000, usd: false },
        { recurringId: "vpn", type: "expense", amountMinor: 5, usd: true },
      ],
      (tx) => !tx.usd,
    );
    expect(settled.paidMinor).toBe(1500);
    expect(settled.paidCount).toBe(1);
    expect(settled.receivedMinor).toBe(4000);
    expect([...settled.ids].sort()).toEqual(["gym", "pay", "vpn"]);
  });
});

describe("bill pill", () => {
  test("late and due today come first; Paid only once the next one is in a later month", () => {
    expect(billPill({ status: "overdue", dueDate: "2026-10-28" }, true, today)).toBe("overdue");
    expect(billPill({ status: "due_today", dueDate: today }, false, today)).toBe("due_today");
    expect(billPill({ status: "upcoming", dueDate: "2026-12-01" }, true, today)).toBe("paid");
    expect(billPill({ status: "due_soon", dueDate: "2026-11-02" }, true, today)).toBe("due_soon");
    expect(billPill({ status: "upcoming", dueDate: "2026-11-20" }, false, today)).toBeNull();
  });
});
