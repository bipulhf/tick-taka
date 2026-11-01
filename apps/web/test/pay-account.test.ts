import { describe, expect, test } from "bun:test";
import { payAccountNeed } from "../src/features/money/pay-account";

const cash = { id: "a1", name: "Cash" };
const bkash = { id: "a2", name: "bKash" };
const gone = { id: "a3", name: "Old", deletedAt: 1 };

describe("which account a Paid needs", () => {
  test("ready when the bill or the default names a live account", () => {
    expect(
      payAccountNeed({ billAccountId: "a1", defaultAccountId: null, accounts: [cash, bkash] }).kind,
    ).toBe("ready");
    expect(
      payAccountNeed({ billAccountId: null, defaultAccountId: "a2", accounts: [cash, bkash] }).kind,
    ).toBe("ready");
  });

  test("a deleted bill account or default doesn't count", () => {
    expect(
      payAccountNeed({
        billAccountId: "a3",
        defaultAccountId: "a3",
        accounts: [cash, bkash, gone],
      }),
    ).toEqual({
      kind: "ask",
      accounts: [cash, bkash],
    });
  });

  test("one live account is used without asking; none says so", () => {
    expect(
      payAccountNeed({ billAccountId: null, defaultAccountId: null, accounts: [cash, gone] }),
    ).toEqual({
      kind: "only",
      accountId: "a1",
    });
    expect(
      payAccountNeed({ billAccountId: null, defaultAccountId: null, accounts: [gone] }).kind,
    ).toBe("no-accounts");
  });
});
