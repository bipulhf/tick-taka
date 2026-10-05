import { describe, expect, test } from "bun:test";
import {
  DAY_MS,
  localMonthRange,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { createTestContext, DEFAULT_NOW } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";

describe("accounts and balances", () => {
  test("balances reconcile across every transaction type", async () => {
    const ctx = await createTestContext();
    const { cash, bkash, usd, category } = await setupMoney(ctx);
    const at = DEFAULT_NOW;
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 25_000,
      categoryId: category("Food").id,
      occurredAt: at,
    });
    await ctx.request("POST", "/transactions", {
      type: "income",
      accountId: bkash.id,
      amountMinor: 200_000,
      occurredAt: at,
    });
    // bKash cash-out of ৳1,000 with an ৳18.50 fee
    await ctx.request("POST", "/transactions", {
      type: "transfer",
      accountId: bkash.id,
      toAccountId: cash.id,
      amountMinor: 100_000,
      feeMinor: 1_850,
      occurredAt: at,
    });
    const noTarget = await ctx.request("POST", "/transactions", {
      type: "transfer",
      accountId: usd.id,
      toAccountId: cash.id,
      amountMinor: 1_000,
      occurredAt: at,
    });
    expect(noTarget.status).toBe(400);
    await ctx.request("POST", "/transactions", {
      type: "transfer",
      accountId: usd.id,
      toAccountId: cash.id,
      amountMinor: 1_000,
      toAmountMinor: 121_500,
      occurredAt: at,
    });
    const accounts = await ctx.request<(Row & { balanceMinor: number })[]>("GET", "/accounts");
    const balance = (id: string) => accounts.body.find((a) => a.id === id)!.balanceMinor;
    expect(balance(cash.id)).toBe(500_000 - 25_000 + 100_000 + 121_500);
    expect(balance(bkash.id)).toBe(1_000_000 + 200_000 - 100_000 - 1_850);
    expect(balance(usd.id)).toBe(-1_000);
  });

  test("balance check logs an adjustment for the difference", async () => {
    const ctx = await createTestContext();
    const { bkash } = await setupMoney(ctx);
    const res = await ctx.request<{ adjustment: { amountMinor: number }; balanceMinor: number }>(
      "POST",
      `/accounts/${bkash.id}/balance-check`,
      { actualMinor: 387_000 },
    );
    expect(res.body.adjustment.amountMinor).toBe(387_000 - 1_000_000);
    const account = await ctx.request<{ balanceMinor: number }>("GET", `/accounts/${bkash.id}`);
    expect(account.body.balanceMinor).toBe(387_000);
    const again = await ctx.request<{ adjustment: null }>(
      "POST",
      `/accounts/${bkash.id}/balance-check`,
      { actualMinor: 387_000 },
    );
    expect(again.body.adjustment).toBeNull();
  });

  test("archived accounts are hidden by default", async () => {
    const ctx = await createTestContext();
    const { usd } = await setupMoney(ctx);
    await ctx.request("PATCH", `/accounts/${usd.id}`, { archived: true });
    expect((await ctx.request<Row[]>("GET", "/accounts")).body).toHaveLength(2);
    expect((await ctx.request<Row[]>("GET", "/accounts?archived=true")).body).toHaveLength(3);
  });
});

describe("transactions", () => {
  test("cursor paging, filters and text search", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    for (let i = 0; i < 5; i++) {
      await ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor: 1000 + i,
        note: i === 2 ? "Foodpanda order" : `item ${i}`,
        occurredAt: DEFAULT_NOW - i * 1000,
      });
    }
    const page1 = await ctx.request<{ items: Row[]; nextCursor: string }>(
      "GET",
      "/transactions?limit=2",
    );
    expect(page1.body.items.map((t) => t.amountMinor)).toEqual([1000, 1001]);
    const page2 = await ctx.request<{ items: Row[]; nextCursor: string | null }>(
      "GET",
      `/transactions?limit=2&cursor=${page1.body.nextCursor}`,
    );
    expect(page2.body.items.map((t) => t.amountMinor)).toEqual([1002, 1003]);
    const page3 = await ctx.request<{ items: Row[]; nextCursor: string | null }>(
      "GET",
      `/transactions?limit=2&cursor=${page2.body.nextCursor}`,
    );
    expect(page3.body.nextCursor).toBeNull();
    const search = await ctx.request<{ items: Row[] }>("GET", "/transactions?q=foodpanda");
    expect(search.body.items).toHaveLength(1);
  });

  test("correcting a category teaches a rule", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const tx = await ctx.request<Row>("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 54_000,
      note: "Foodpanda",
      categoryId: category("Shopping").id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("PATCH", `/transactions/${tx.body.id}`, { categoryId: category("Food").id });
    const rules = await ctx.request<Row[]>("GET", "/category-rules");
    expect(rules.body).toEqual([
      expect.objectContaining({ matchText: "foodpanda", categoryId: category("Food").id }),
    ]);
  });

  test("delete then undo", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const tx = await ctx.request<Row>("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 100,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("DELETE", `/transactions/${tx.body.id}`);
    expect(
      (await ctx.request<{ balanceMinor: number }>("GET", `/accounts/${cash.id}`)).body
        .balanceMinor,
    ).toBe(500_000);
    await ctx.request("POST", `/transactions/${tx.body.id}/restore`);
    expect(
      (await ctx.request<{ balanceMinor: number }>("GET", `/accounts/${cash.id}`)).body
        .balanceMinor,
    ).toBe(499_900);
  });
});

describe("categories", () => {
  test("at most two levels deep", async () => {
    const ctx = await createTestContext();
    const { category } = await setupMoney(ctx);
    const eatingOut = category("Eating out");
    const res = await ctx.request("POST", "/categories", {
      name: "Fine dining",
      emoji: "🍷",
      parentId: eatingOut.id,
    });
    expect(res.status).toBe(400);
    const child = await ctx.request<Row>("POST", "/categories", {
      name: "Snacks",
      emoji: "🍪",
      parentId: category("Food").id,
    });
    expect(child.body).toMatchObject({ kind: "expense", budgetType: "flexible" });
  });
});

describe("budgets and safe to spend", () => {
  test("buckets, children roll into parents, safe-to-spend matches the spec example", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const food = category("Food");
    const transport = category("Transport");
    const rent = category("Rent");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 1_200_000 },
        { categoryId: transport.id, limitMinor: 600_000 },
        { categoryId: rent.id, limitMinor: 2_000_000 },
      ],
    });
    const yesterday = startOfLocalDay("2026-10-03", TZ) + 3_600_000;
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 8_000,
      categoryId: category("Eating out").id,
      occurredAt: yesterday,
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 2_000_000,
      categoryId: rent.id,
      occurredAt: yesterday,
    });
    // Spent today does not shrink today's allowance, only what's left of it.
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 12_000,
      categoryId: food.id,
      occurredAt: DEFAULT_NOW,
    });

    const month = await ctx.request<{
      buckets: Record<string, { limitMinor: number; spentMinor: number }>;
      lines: Row[];
    }>("GET", "/budgets?month=2026-10");
    expect(month.body.buckets.flexible).toMatchObject({
      limitMinor: 1_800_000,
      spentMinor: 20_000,
    });
    expect(month.body.buckets.fixed).toMatchObject({
      limitMinor: 2_000_000,
      spentMinor: 2_000_000,
    });
    expect(month.body.lines.find((l) => l.categoryId === food.id)).toMatchObject({
      spentMinor: 20_000,
      pace: "on_track",
    });

    const safe = await ctx.request<{
      dailyMinor: number;
      spentTodayMinor: number;
      leftTodayMinor: number;
      daysLeft: number;
    }>("GET", "/budgets/safe-to-spend");
    // (18,000 − 80) ÷ 28 days = ৳640
    expect(safe.body).toEqual(
      expect.objectContaining({
        dailyMinor: 64_000,
        spentTodayMinor: 12_000,
        leftTodayMinor: 52_000,
        daysLeft: 28,
      }),
    );
  });

  test("next month inherits limits and rollover carries unspent money", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: fun.id, limitMinor: 300_000, rollover: true }],
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 100_000,
      categoryId: fun.id,
      occurredAt: DEFAULT_NOW,
    });
    const november = await ctx.request<{ inherited: boolean; lines: Row[] }>(
      "GET",
      "/budgets?month=2026-11",
    );
    expect(november.body.inherited).toBe(true);
    await ctx.request("PUT", "/budgets", {
      month: "2026-11",
      budgets: [{ categoryId: fun.id, limitMinor: 300_000, rollover: true }],
    });
    const saved = await ctx.request<{ lines: Row[] }>("GET", "/budgets?month=2026-11");
    expect(saved.body.lines.find((l) => l.categoryId === fun.id)).toMatchObject({
      carriedMinor: 200_000,
      availableMinor: 500_000,
    });
  });
});

describe("recurring bills and income", () => {
  test("paying a bill creates the expense and moves the due date", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const due = zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 9 }, TZ);
    const bill = await ctx.request<Row>("POST", "/recurring", {
      kind: "bill",
      name: "Internet",
      amountMinor: 120_000,
      accountId: cash.id,
      categoryId: category("Bills").id,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
      nextDueAt: due,
    });
    const list = await ctx.request<(Row & { status: string })[]>("GET", "/recurring");
    expect(list.body[0]!.status).toBe("due_soon");
    const paid = await ctx.request<{ transaction: Row; recurring: Row }>(
      "POST",
      `/recurring/${bill.body.id}/pay`,
      {},
    );
    expect(paid.body.transaction).toMatchObject({
      type: "expense",
      amountMinor: 120_000,
      recurringId: bill.body.id,
    });
    expect(paid.body.recurring.nextDueAt).toBe(
      zonedTimeToUtc({ year: 2026, month: 11, day: 5, hour: 9 }, TZ),
    );
  });

  test("foreign salary converts at the rate entered", async () => {
    const ctx = await createTestContext();
    const { bkash } = await setupMoney(ctx);
    const salary = await ctx.request<Row>("POST", "/recurring", {
      kind: "income",
      name: "Job 2 salary",
      amountMinor: 100_000,
      currency: "USD",
      rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
      nextDueAt: DEFAULT_NOW,
    });
    const noRate = await ctx.request("POST", `/recurring/${salary.body.id}/pay`, {
      accountId: bkash.id,
    });
    expect(noRate.status).toBe(400);
    const res = await ctx.request<{ transaction: Row }>(
      "POST",
      `/recurring/${salary.body.id}/pay`,
      { accountId: bkash.id, rate: 121.5 },
    );
    expect(res.body.transaction).toMatchObject({ type: "income", amountMinor: 12_150_000 });
    expect(res.body.transaction.note).toContain("$1,000 @ 121.50");
  });

  test("overdue job flags unpaid bills", async () => {
    const ctx = await createTestContext();
    const { recurringService } = await import("../src/modules/recurring/service");
    await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Gas",
      amountMinor: 1,
      rrule: "FREQ=MONTHLY",
      nextDueAt: DEFAULT_NOW - 2 * DAY_MS,
    });
    expect(recurringService(ctx.deps).markOverdue()).toBe(1);
    expect(recurringService(ctx.deps).markOverdue()).toBe(0);
  });
});

describe("goals", () => {
  test("contributions, suggested monthly amount and a monthly jar task", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const goal = await ctx.request<Row & { suggestedMonthlyMinor: number }>("POST", "/goals", {
      name: "Laptop",
      targetMinor: 1_200_000,
      deadline: "2027-03-31",
    });
    expect(goal.body.suggestedMonthlyMinor).toBe(200_000);
    const jarTasks = await ctx.request<Row[]>("GET", "/tasks");
    expect(jarTasks.body.map((t) => t.title)).toEqual(["Move ৳2,000 to the Laptop jar"]);
    const { goalService } = await import("../src/modules/goals/service");
    expect(goalService(ctx.deps).ensureMonthlyTasks()).toBe(0);
    const res = await ctx.request<{ goal: Row & { savedMinor: number }; justReached: boolean }>(
      "POST",
      `/goals/${goal.body.id}/contribute`,
      { amountMinor: 1_200_000, fromAccountId: cash.id },
    );
    expect(res.body.goal.savedMinor).toBe(1_200_000);
    expect(res.body.justReached).toBe(true);
    // Money set aside for a goal is not spending.
    const month = await ctx.request<{ buckets: { flexible: { spentMinor: number } } }>(
      "GET",
      "/budgets?month=2026-10",
    );
    expect(month.body.buckets.flexible.spentMinor).toBe(0);
  });
});

describe("debts", () => {
  test("lend, repay in parts, auto-close and forecast", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const debt = await ctx.request<Row & { outstandingMinor: number }>("POST", "/debts", {
      person: "Rahim",
      direction: "owed_to_me",
      principalMinor: 1_000_000,
      accountId: cash.id,
    });
    expect(debt.body.outstandingMinor).toBe(1_000_000);
    const forecast = await ctx.request<{ months: number; clearedIn: string }>(
      "GET",
      `/debts/${debt.body.id}/forecast?monthly=300000`,
    );
    expect(forecast.body).toMatchObject({ months: 4, clearedIn: "2027-01" });
    await ctx.request("POST", `/debts/${debt.body.id}/repay`, {
      amountMinor: 400_000,
      accountId: cash.id,
    });
    const closed = await ctx.request<Row & { outstandingMinor: number }>(
      "POST",
      `/debts/${debt.body.id}/repay`,
      { amountMinor: 600_000, accountId: cash.id },
    );
    expect(closed.body.outstandingMinor).toBe(0);
    expect(closed.body.closedAt).toBe(DEFAULT_NOW);
    expect(
      (await ctx.request<{ balanceMinor: number }>("GET", `/accounts/${cash.id}`)).body
        .balanceMinor,
    ).toBe(500_000);
    const month = await ctx.request<{ buckets: { flexible: { spentMinor: number } } }>(
      "GET",
      "/budgets?month=2026-10",
    );
    expect(month.body.buckets.flexible.spentMinor).toBe(0);
  });
});

describe("events and shopping", () => {
  test("event collects spending from every account", async () => {
    const ctx = await createTestContext();
    const { cash, bkash } = await setupMoney(ctx);
    const trip = await ctx.request<Row>("POST", "/events", {
      name: "Sylhet trip",
      budgetMinor: 1_500_000,
      startsOn: "2026-10-10",
      endsOn: "2026-10-13",
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 300_000,
      eventId: trip.body.id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: bkash.id,
      amountMinor: 200_000,
      eventId: trip.body.id,
      occurredAt: DEFAULT_NOW,
    });
    const event = await ctx.request<Row>("GET", `/events/${trip.body.id}`);
    expect(event.body).toMatchObject({
      spentMinor: 500_000,
      leftMinor: 1_000_000,
      transactionCount: 2,
    });
    expect(
      await ctx.request("POST", "/events", {
        name: "Bad",
        startsOn: "2026-10-10",
        endsOn: "2026-10-01",
      }),
    ).toMatchObject({ status: 400 });
  });

  test("checkout turns ticked items into one expense", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const rice = await ctx.request<Row>("POST", "/shopping", {
      listName: "Bazar",
      title: "Rice 5kg",
      estMinor: 45_000,
    });
    const eggs = await ctx.request<Row>("POST", "/shopping", {
      listName: "Bazar",
      title: "Eggs",
      estMinor: 15_000,
    });
    await ctx.request("POST", "/shopping", { listName: "Bazar", title: "Fish", estMinor: 60_000 });
    const lists = await ctx.request<unknown[]>("GET", "/shopping/lists");
    expect(lists.body).toEqual([
      { listName: "Bazar", itemCount: 3, estTotalMinor: 120_000, checkedCount: 0 },
    ]);
    expect(
      (await ctx.request("POST", "/shopping/checkout", { listName: "Bazar", accountId: cash.id }))
        .status,
    ).toBe(400);
    await ctx.request("PATCH", `/shopping/${rice.body.id}`, { checked: true });
    await ctx.request("PATCH", `/shopping/${eggs.body.id}`, { checked: true });
    const res = await ctx.request<{ amountMinor: number; items: number }>(
      "POST",
      "/shopping/checkout",
      { listName: "Bazar", accountId: cash.id },
    );
    expect(res.body).toMatchObject({ amountMinor: 60_000, items: 2 });
    expect(
      (await ctx.request<Row[]>("GET", "/shopping?list=Bazar")).body.map((i) => i.title),
    ).toEqual(["Fish"]);
  });
});

describe("receipt uploads", () => {
  test("upload and fetch with auth only", async () => {
    const ctx = await createTestContext();
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.jpg", { type: "image/jpeg" }),
    );
    const res = await ctx.app.request("/uploads", {
      method: "POST",
      body: form,
      headers: { authorization: `Bearer ${ctx.token}` },
    });
    expect(res.status).toBe(201);
    const { path } = (await res.json()) as { path: string };
    expect((await ctx.app.request(`/uploads/${path}`)).status).toBe(401);
    const fetched = await ctx.app.request(`/uploads/${path}?token=${ctx.token}`);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-type")).toContain("image/jpeg");
  });
});

test("month range helper sanity", () => {
  const { from } = localMonthRange("2026-10", TZ);
  expect(toLocalDate(from, TZ)).toBe("2026-10-01");
});
