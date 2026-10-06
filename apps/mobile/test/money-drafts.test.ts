import { describe, expect, test } from "bun:test";
import {
  draftOutcome,
  draftRequest,
  draftView,
  parseDrafts,
} from "../src/features/assistant/money-drafts";

const expense = {
  summary: "Add transaction rickshaw",
  method: "POST",
  path: "/transactions",
  body: {
    id: "tx-1",
    type: "expense",
    amountMinor: 12_000,
    accountId: "cash",
    categoryId: "transport",
    occurredAt: 1_000,
    note: "rickshaw",
  },
  undo: { method: "DELETE", path: "/transactions/tx-1" },
};

const lookup = {
  accounts: [{ id: "cash", name: "Cash" }],
  categories: [{ id: "transport", name: "Transport", emoji: "🛺" }],
};

describe("assistant money drafts", () => {
  test("well-formed drafts are kept as pending; malformed ones dropped", () => {
    const drafts = parseDrafts([expense, { summary: "no path" }, "junk"]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.state).toBe("pending");
    expect(parseDrafts(undefined)).toEqual([]);
  });

  test("Save sends exactly the proposed request, with its id, through the outbox", () => {
    const [draft] = parseDrafts([expense]);
    expect(draftRequest(draft!, 99)).toEqual({
      method: "POST",
      path: "/transactions",
      body: expense.body,
      label: "Couldn't save: Add transaction rickshaw",
    });
  });

  test("a proposed edit gets the edit time, like an Undo", () => {
    const [draft] = parseDrafts([
      {
        summary: "Change transaction",
        method: "PATCH",
        path: "/transactions/t",
        body: { amountMinor: 5 },
      },
    ]);
    expect(draftRequest(draft!, 1234).body).toEqual({ amountMinor: 5, updatedAt: 1234 });
  });

  test("the card shows a signed amount with account, category and date by name", () => {
    const [draft] = parseDrafts([expense]);
    expect(draftView(draft!, lookup)).toEqual({
      title: "Add transaction rickshaw",
      amountMinor: -12_000,
      signed: true,
      account: "Cash",
      category: "🛺 Transport",
      date: 1_000,
    });
  });

  test("income is positive; a goal top-up shows its amount unsigned", () => {
    const [income] = parseDrafts([
      { ...expense, body: { ...expense.body, type: "income", amountMinor: 4_500_000 } },
    ]);
    expect(draftView(income!, lookup).amountMinor).toBe(4_500_000);
    const [goal] = parseDrafts([
      {
        summary: "Add to a goal",
        method: "POST",
        path: "/goals/g/contribute",
        body: { id: "c", amountMinor: 50_000 },
      },
    ]);
    expect(draftView(goal!, lookup)).toMatchObject({
      amountMinor: 50_000,
      signed: false,
      account: null,
    });
  });

  // QA-208: budgets and other money fields are drafts now; the card shows their amount.
  test("a budget draft shows the line's amount and category; targets and budgets show too", () => {
    const [budget] = parseDrafts([
      {
        summary: "Set the Transport budget for 2026-10",
        method: "PUT",
        path: "/budgets",
        body: { month: "2026-10", budgets: [{ categoryId: "transport", limitMinor: 800_000 }] },
        undo: { method: "PUT", path: "/budgets", body: { month: "2026-10", budgets: [] } },
        amountMinor: 800_000,
        categoryId: "transport",
      },
    ]);
    expect(draftView(budget!, lookup)).toMatchObject({
      amountMinor: 800_000,
      signed: false,
      category: "🛺 Transport",
    });
    for (const field of ["targetMinor", "budgetMinor", "estMinor", "openingMinor"]) {
      const [draft] = parseDrafts([
        { summary: "Change", method: "PATCH", path: "/goals/g", body: { [field]: 9_000 } },
      ]);
      expect(draftView(draft!, lookup).amountMinor).toBe(9_000);
    }
  });

  // QA-209: a pay draft saved after the bill was paid elsewhere changes nothing; say so.
  test("saving a pay draft for a bill already paid says nothing changed", () => {
    const [pay] = parseDrafts([
      {
        summary: "Pay “Internet”",
        method: "POST",
        path: "/recurring/b/pay",
        body: { transactionId: "t", dueAt: 5 },
      },
    ]);
    expect(draftOutcome(pay!, { transaction: null, recurring: {} })).toBe(
      "Pay “Internet”: already done, so nothing changed",
    );
    expect(draftOutcome(pay!, { transaction: { id: "t" }, recurring: {} })).toBeNull();
    const [skip] = parseDrafts([
      { summary: "Skip", method: "POST", path: "/recurring/b/pay", body: { skip: true } },
    ]);
    expect(draftOutcome(skip!, { transaction: null, recurring: {} })).toBeNull();
    expect(draftOutcome(parseDrafts([expense])[0]!, { id: "tx-1" })).toBeNull();
  });
});
