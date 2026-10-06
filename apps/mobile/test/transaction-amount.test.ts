import { describe, expect, test } from "bun:test";
import { formatAmount } from "@tick-taka/shared/money";
import { transactionAmount } from "../src/features/money/transaction-amount";

const shown = (display: ReturnType<typeof transactionAmount>) =>
  formatAmount(display.minor, { signed: display.signed });

describe("transaction amounts carry a sign, not just a colour", () => {
  test("an expense reads −৳120 in coral", () => {
    const display = transactionAmount({ type: "expense", amountMinor: 12_000 });
    expect(shown(display)).toBe("−৳120");
    expect(display.tone).toBe("coral");
  });

  test("income reads +৳45,000 in mint", () => {
    const display = transactionAmount({ type: "income", amountMinor: 4_500_000 });
    expect(shown(display)).toBe("+৳45,000");
    expect(display.tone).toBe("mint");
  });

  test("a transfer is neutral, unsigned and marked as a transfer", () => {
    const display = transactionAmount({ type: "transfer", amountMinor: 50_000, toAccountId: "b" });
    expect(shown(display)).toBe("৳500");
    expect(display).toMatchObject({ tone: "ink", transfer: true });
  });

  test("seen from an account, a transfer is signed by direction but stays neutral", () => {
    const tx = { type: "transfer", amountMinor: 50_000, toAmountMinor: 49_000, toAccountId: "b" };
    expect(shown(transactionAmount(tx, "b"))).toBe("+৳490");
    expect(shown(transactionAmount(tx, "a"))).toBe("−৳500");
    expect(transactionAmount(tx, "b").tone).toBe("ink");
  });

  test("balance checks are signed by direction", () => {
    expect(shown(transactionAmount({ type: "adjustment", amountMinor: 2_000 }))).toBe("+৳20");
    expect(shown(transactionAmount({ type: "adjustment", amountMinor: -2_000 }))).toBe("−৳20");
  });
});
