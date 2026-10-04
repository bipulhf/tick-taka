import type { TestContext } from "./helpers";

export type Row = Record<string, unknown> & { id: string };

export async function setupMoney(ctx: TestContext) {
  const cash = (
    await ctx.request<Row>("POST", "/accounts", {
      name: "Cash",
      type: "cash",
      openingMinor: 500_000,
    })
  ).body;
  const bkash = (
    await ctx.request<Row>("POST", "/accounts", {
      name: "bKash",
      type: "mobile_wallet",
      openingMinor: 1_000_000,
    })
  ).body;
  const usd = (
    await ctx.request<Row>("POST", "/accounts", { name: "Payoneer", type: "bank", currency: "USD" })
  ).body;
  const categories = (await ctx.request<Row[]>("GET", "/categories")).body;
  const category = (name: string) => categories.find((c) => c.name === name)!;
  return { cash, bkash, usd, category };
}
