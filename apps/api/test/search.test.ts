import { describe, expect, test } from "bun:test";
import { createTestContext, DEFAULT_NOW } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

describe("search treats % _ and \\ literally", () => {
  test("transaction notes", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    for (const note of ["50% off shoes", "500 off", "a_b cable", "axb cable", "C:\\temp fee"]) {
      await ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor: 1_000,
        categoryId: category("Food").id,
        note,
        occurredAt: DEFAULT_NOW,
      });
    }
    const search = async (q: string) =>
      (
        await ctx.request<{ items: Row[] }>("GET", `/transactions?q=${encodeURIComponent(q)}`)
      ).body.items.map((t) => t.note);
    expect(await search("50%")).toEqual(["50% off shoes"]);
    expect(await search("a_b")).toEqual(["a_b cable"]);
    expect(await search("C:\\temp")).toEqual(["C:\\temp fee"]);
    expect((await search("cable")).sort()).toEqual(["a_b cable", "axb cable"]);
  });

  test("task titles and notes", async () => {
    const ctx = await createTestContext();
    await ctx.request("POST", "/tasks", { title: "Pay 100% of rent", status: "open" });
    await ctx.request("POST", "/tasks", { title: "Pay 1000 of rent", status: "open" });
    await ctx.request("POST", "/tasks", { title: "Rename", notes: "file_v2", status: "open" });
    await ctx.request("POST", "/tasks", { title: "Rename", notes: "filexv2", status: "open" });
    const search = async (q: string) =>
      (await ctx.request<Row[]>("GET", `/tasks?q=${encodeURIComponent(q)}`)).body.map(
        (t) => t.notes ?? t.title,
      );
    expect(await search("100%")).toEqual(["Pay 100% of rent"]);
    expect(await search("file_v2")).toEqual(["file_v2"]);
  });
});
