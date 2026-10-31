import { expect, test } from "bun:test";
import { splitOfferMessage, splitOfferMinor } from "../src/payday";

test("a received income in the budgets' currency offers its amount", () => {
  expect(splitOfferMinor({ income: true, amountMinor: 4_500_000, currency: "BDT" }, "BDT")).toBe(
    4_500_000,
  );
});

test("bills, foreign income and zero amounts offer nothing", () => {
  expect(splitOfferMinor({ income: false, amountMinor: 120_000, currency: "BDT" }, "BDT")).toBe(
    null,
  );
  expect(splitOfferMinor({ income: true, amountMinor: 50_000, currency: "USD" }, "BDT")).toBe(null);
  expect(splitOfferMinor({ income: true, amountMinor: 0, currency: "BDT" }, "BDT")).toBe(null);
});

test("the message names the amount unless amounts are hidden", () => {
  expect(splitOfferMessage("Salary", "৳45,000")).toBe("Salary logged. Split this ৳45,000?");
  expect(splitOfferMessage("Salary", null)).toBe("Salary logged. Split it?");
});
