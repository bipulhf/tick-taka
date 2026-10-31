import { describe, expect, test } from "bun:test";
import { openDatabase } from "../src/db/client";
import { seedDefaults } from "../src/db/seed";
import { readSettings } from "../src/modules/settings/service";
import { createTestContext } from "./helpers";

type Row = Record<string, unknown> & { id: string };

describe("a new user's database", () => {
  test("starts with a Cash account set as the default and cash account", async () => {
    const { request } = await createTestContext();
    const accounts = (await request<Row[]>("GET", "/accounts")).body;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      name: "Cash",
      type: "cash",
      currency: "BDT",
      openingMinor: 0,
    });
    const settings = (await request<Row>("GET", "/settings")).body;
    expect(settings.defaultAccountId).toBe(accounts[0]?.id);
    expect(settings.cashAccountId).toBe(accounts[0]?.id);
  });

  test("an expense typed on day one lands in Cash", async () => {
    const { request, clock } = await createTestContext();
    const [cash] = (await request<Row[]>("GET", "/accounts")).body;
    const saved = await request<Row>("POST", "/transactions", {
      type: "expense",
      accountId: cash?.id,
      amountMinor: 25_000,
      note: "lunch",
      occurredAt: clock.now,
    });
    expect(saved.status).toBe(201);
    const after = (await request<(Row & { balanceMinor: number })[]>("GET", "/accounts")).body;
    expect(after[0]?.balanceMinor).toBe(-25_000);
  });

  test("starts with one routine, Morning, without picking the top three", async () => {
    const { request } = await createTestContext();
    const routines = (await request<(Row & { steps: { title: string }[] })[]>("GET", "/routines"))
      .body;
    expect(routines.map((r) => r.name)).toEqual(["Morning"]);
    expect(routines[0]?.steps.map((s) => s.title)).toEqual([
      "Drink a glass of water",
      "Stretch",
      "Check bills due today",
    ]);
  });

  test("a database that already has an account gets no second one", () => {
    const { db, sqlite } = openDatabase(":memory:");
    sqlite.exec(
      `insert into accounts (id, name, type, currency, opening_minor, sort, created_at, updated_at)
       values ('01JAAAAAAAAAAAAAAAAAAAAAAA', 'City Bank', 'bank', 'BDT', 0, 0, 1, 1)`,
    );
    expect(seedDefaults(db, Date.now())).toBe(true);
    const names = sqlite.query("select name from accounts").all() as { name: string }[];
    expect(names.map((a) => a.name)).toEqual(["City Bank"]);
    expect(readSettings(db).defaultAccountId).toBeNull();
    sqlite.close();
  });

  test("a seeded database is never seeded again", () => {
    const { db, sqlite } = openDatabase(":memory:");
    seedDefaults(db, Date.now());
    expect(seedDefaults(db, Date.now())).toBe(false);
    const accounts = sqlite.query("select count(*) as n from accounts").get() as { n: number };
    expect(accounts.n).toBe(1);
    sqlite.close();
  });
});
