import { describe, expect, test } from "bun:test";
import { payNeedsRate } from "../src/features/today/pay-needs-rate";

const accounts = [
  { id: "cash", currency: "BDT" },
  { id: "card", currency: "USD" },
];
const settings = { defaultAccountId: "cash", defaultCurrency: "BDT" };

// QA-213: a USD bill paid from a taka account needs a rate; posting it blind fails.
describe("Paid from Today", () => {
  test("a bill in another currency than its account asks for the rate", () => {
    expect(payNeedsRate({ currency: "USD", accountId: "cash" }, accounts, settings)).toBe(true);
    expect(payNeedsRate({ currency: "USD", accountId: null }, accounts, settings)).toBe(true);
    expect(payNeedsRate({ currency: "BDT", accountId: "card" }, accounts, settings)).toBe(true);
  });

  test("same currency goes straight through", () => {
    expect(payNeedsRate({ currency: "BDT", accountId: null }, accounts, settings)).toBe(false);
    expect(payNeedsRate({ currency: "USD", accountId: "card" }, accounts, settings)).toBe(false);
  });

  test("with accounts not loaded yet, anything not in the default currency asks", () => {
    expect(payNeedsRate({ currency: "USD", accountId: "card" }, undefined, settings)).toBe(true);
    expect(payNeedsRate({ currency: "BDT" }, undefined, undefined)).toBe(false);
  });
});
