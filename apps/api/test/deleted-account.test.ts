import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext, DEFAULT_NOW, type TestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

type Reply = { status: number; body: { error?: { code: string; message: string } } };

const refused = (reply: Reply) => {
  expect(reply.status).toBe(400);
  expect(reply.body.error?.code).toBe("account_deleted");
};

async function withDeletedAccount() {
  const ctx = await createTestContext();
  const money = await setupMoney(ctx);
  const gone = (await ctx.request<Row>("POST", "/accounts", { name: "Old wallet", type: "cash" }))
    .body;
  expect((await ctx.request("DELETE", `/accounts/${gone.id}`)).status).toBe(200);
  return { ctx, ...money, gone };
}

const expense = (ctx: TestContext, accountId: string, id?: string) =>
  ctx.request("POST", "/transactions", {
    ...(id ? { id } : {}),
    type: "expense",
    accountId,
    amountMinor: 5_000,
    occurredAt: DEFAULT_NOW,
  }) as Promise<Reply>;

describe("writes to a deleted account", () => {
  test("an expense, a transfer or a changed account is refused", async () => {
    const { ctx, cash, gone } = await withDeletedAccount();
    refused(await expense(ctx, gone.id));
    refused(
      (await ctx.request("POST", "/transactions", {
        type: "transfer",
        accountId: cash.id,
        toAccountId: gone.id,
        amountMinor: 5_000,
        occurredAt: DEFAULT_NOW,
      })) as Reply,
    );
    const ok = (await expense(ctx, cash.id)) as Reply & { body: Row };
    expect(ok.status).toBe(201);
    refused(
      (await ctx.request("PATCH", `/transactions/${ok.body.id}`, { accountId: gone.id })) as Reply,
    );
  });

  test("an old expense in the account can still be edited, and a replay still lands", async () => {
    const ctx = await createTestContext();
    const wallet = (
      await ctx.request<Row>("POST", "/accounts", { name: "Old wallet", type: "cash" })
    ).body;
    const id = newId(DEFAULT_NOW);
    expect((await expense(ctx, wallet.id, id)).status).toBe(201);
    await ctx.request("DELETE", `/accounts/${wallet.id}`);
    // The phone sends a write again when it never heard back: it already landed.
    expect((await expense(ctx, wallet.id, id)).status).toBe(201);
    const edit = await ctx.request<Row>("PATCH", `/transactions/${id}`, { note: "Tea" });
    expect(edit.status).toBe(200);
    expect(edit.body.note).toBe("Tea");
  });

  test("bill pay, goal contribute, debt repay and balance check are refused", async () => {
    const { ctx, cash, gone } = await withDeletedAccount();
    const bill = (
      await ctx.request<Row>("POST", "/recurring", {
        kind: "bill",
        name: "Gas",
        amountMinor: 1_000,
        rrule: "FREQ=MONTHLY",
        nextDueAt: DEFAULT_NOW,
      })
    ).body;
    refused(
      (await ctx.request("POST", `/recurring/${bill.id}/pay`, { accountId: gone.id })) as Reply,
    );

    const goal = (await ctx.request<Row>("POST", "/goals", { name: "Bike", targetMinor: 10_000 }))
      .body;
    refused(
      (await ctx.request("POST", `/goals/${goal.id}/contribute`, {
        amountMinor: 1_000,
        fromAccountId: gone.id,
      })) as Reply,
    );

    const debt = (
      await ctx.request<Row>("POST", "/debts", {
        person: "Rahim",
        direction: "owed_to_me",
        principalMinor: 10_000,
        accountId: cash.id,
      })
    ).body;
    refused(
      (await ctx.request("POST", `/debts/${debt.id}/repay`, {
        amountMinor: 1_000,
        accountId: gone.id,
      })) as Reply,
    );

    refused(
      (await ctx.request("POST", `/accounts/${gone.id}/balance-check`, {
        actualMinor: 1_000,
      })) as Reply,
    );
  });

  test("a bill, goal or debt can't be set up in it", async () => {
    const { ctx, gone } = await withDeletedAccount();
    refused(
      (await ctx.request("POST", "/recurring", {
        kind: "bill",
        name: "Gas",
        amountMinor: 1_000,
        rrule: "FREQ=MONTHLY",
        nextDueAt: DEFAULT_NOW,
        accountId: gone.id,
      })) as Reply,
    );
    refused(
      (await ctx.request("POST", "/goals", {
        name: "Bike",
        targetMinor: 10_000,
        accountId: gone.id,
      })) as Reply,
    );
    refused(
      (await ctx.request("POST", "/debts", {
        person: "Rahim",
        direction: "owed_to_me",
        principalMinor: 10_000,
        accountId: gone.id,
      })) as Reply,
    );
  });
});
