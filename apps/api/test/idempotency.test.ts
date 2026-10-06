import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

/** A retried request (lost response, double tap) must succeed the second time too. */
describe("replayed actions succeed", () => {
  test("shopping checkout with the same transactionId returns the same expense", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const rice = await ctx.request<Row>("POST", "/shopping", {
      listName: "Bazar",
      title: "Rice 5kg",
      estMinor: 45_000,
    });
    await ctx.request("PATCH", `/shopping/${rice.body.id}`, { checked: true });
    const body = { transactionId: newId(), listName: "Bazar", accountId: cash.id };
    const first = await ctx.request<Row>("POST", "/shopping/checkout", body);
    expect(first.status).toBe(200);
    const replay = await ctx.request<Row>("POST", "/shopping/checkout", body);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(1);
  });

  test("deleting twice and restoring twice both succeed", async () => {
    const ctx = await createTestContext();
    const area = await ctx.request<Row>("POST", "/areas", {
      name: "Side gig",
      emoji: "💼",
      color: "#FFB547",
    });
    const path = `/areas/${area.body.id}`;
    expect((await ctx.request("DELETE", path)).status).toBe(200);
    const again = await ctx.request<Row>("DELETE", path);
    expect(again.status).toBe(200);
    expect(again.body.deletedAt).not.toBeNull();
    expect((await ctx.request("POST", `${path}/restore`)).status).toBe(200);
    const restoredAgain = await ctx.request<Row>("POST", `${path}/restore`);
    expect(restoredAgain.status).toBe(200);
    expect(restoredAgain.body.deletedAt).toBeNull();
    expect((await ctx.request("DELETE", `/areas/${newId()}`)).status).toBe(404);
  });
});
