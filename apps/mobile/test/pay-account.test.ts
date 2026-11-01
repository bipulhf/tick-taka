import { describe, expect, test } from "bun:test";
import { payAccount, rememberAccountRequest } from "../src/features/money/pay-account";

const cash = { id: "cash", name: "Cash" };
const bkash = { id: "bkash", name: "bKash" };
const both = [cash, bkash];

// A bill Tiki or subscription tracking made has no account; with no default in
// Settings, "Paid" was refused on the server ("Pick the account this was paid from").
describe("which account a Paid goes through", () => {
  test("no account on the bill and no default: asks, from the live accounts", () => {
    expect(payAccount({ billAccountId: null, defaultAccountId: null, accounts: both })).toEqual({
      kind: "pick",
      accounts: both,
    });
  });

  test("a deleted bill account or default counts as missing", () => {
    expect(
      payAccount({ billAccountId: "gone", defaultAccountId: "gone-too", accounts: both }).kind,
    ).toBe("pick");
    // The server tries the bill's account first, so a live default is sent by name.
    expect(payAccount({ billAccountId: "gone", defaultAccountId: "cash", accounts: both })).toEqual(
      { kind: "pay", accountId: "cash", remember: false },
    );
  });

  test("the bill's own account, then the default, go straight through", () => {
    expect(
      payAccount({ billAccountId: "bkash", defaultAccountId: "cash", accounts: both }),
    ).toEqual({ kind: "pay", accountId: "bkash", remember: false });
    expect(payAccount({ billAccountId: null, defaultAccountId: "cash", accounts: both })).toEqual({
      kind: "pay",
      accountId: "cash",
      remember: false,
    });
  });

  test("an account the caller picked wins, unless it was deleted", () => {
    expect(
      payAccount({
        chosen: "bkash",
        billAccountId: "cash",
        defaultAccountId: null,
        accounts: both,
      }),
    ).toEqual({ kind: "pay", accountId: "bkash", remember: false });
    expect(
      payAccount({ chosen: "gone", billAccountId: null, defaultAccountId: null, accounts: both })
        .kind,
    ).toBe("pick");
  });

  test("one account left: used without asking, and remembered on the bill", () => {
    expect(payAccount({ billAccountId: null, defaultAccountId: "gone", accounts: [cash] })).toEqual(
      { kind: "pay", accountId: "cash", remember: true },
    );
  });

  test("no account at all: one has to be added first", () => {
    expect(payAccount({ billAccountId: null, defaultAccountId: null, accounts: [] })).toEqual({
      kind: "add-account",
    });
  });

  test("before the account list loads, it goes with what the bill and Settings name", () => {
    expect(
      payAccount({ billAccountId: null, defaultAccountId: "cash", accounts: undefined }),
    ).toEqual({ kind: "pay", accountId: "cash", remember: false });
    expect(
      payAccount({ billAccountId: null, defaultAccountId: null, accounts: undefined }),
    ).toEqual({ kind: "pay", accountId: undefined, remember: false });
  });

  test("remembering is one PATCH with the edit time", () => {
    expect(rememberAccountRequest({ id: "rent", name: "Rent" }, "cash", 1234)).toEqual({
      method: "PATCH",
      path: "/recurring/rent",
      body: { accountId: "cash", updatedAt: 1234 },
      label: "Couldn't save the account for Rent",
    });
  });
});
