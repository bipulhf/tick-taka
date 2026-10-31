import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext } from "./helpers";
import type { Row } from "./money-helpers";

/** A retried request (lost response, double tap) must succeed the second time too. */
describe("replayed actions succeed", () => {
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
