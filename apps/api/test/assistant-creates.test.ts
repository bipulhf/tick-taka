import { describe, expect, test } from "bun:test";
import {
  accountCreateSchema,
  categoryCreateSchema,
  debtCreateSchema,
  eventCreateSchema,
  goalCreateSchema,
  recurringCreateSchema,
  transactionCreateSchema,
} from "@tick-taka/shared/schemas/money";
import {
  areaCreateSchema,
  habitCreateSchema,
  projectCreateSchema,
  routineCreateSchema,
  taskCreateSchema,
  timeEntryCreateSchema,
} from "@tick-taka/shared/schemas/time";
import type { z } from "zod";
import { ENTITIES, type EntityName } from "../src/modules/ai/assistant/entities";
import { call, fields, setup } from "./assistant-helpers";

const SCHEMAS: Record<EntityName, z.ZodObject> = {
  task: taskCreateSchema,
  project: projectCreateSchema,
  area: areaCreateSchema,
  habit: habitCreateSchema,
  transaction: transactionCreateSchema,
  account: accountCreateSchema,
  category: categoryCreateSchema,
  bill: recurringCreateSchema,
  goal: goalCreateSchema,
  debt: debtCreateSchema,
  event: eventCreateSchema,
  routine: routineCreateSchema,
  time_entry: timeEntryCreateSchema,
};
/** The model's names for API fields. */
const API_KEY: Record<string, string> = {
  amount: "amountMinor",
  target: "targetMinor",
  principal: "principalMinor",
  area: "areaId",
};
/** Filled in by the tool runner itself: the default account, and now. */
const RUNNER_FILLS: Partial<Record<EntityName, string[]>> = {
  transaction: ["accountId", "occurredAt"],
};

/** "required: name, amount (taka, more than 0). Optional: …" → ["name", "amount"] */
function requiredIn(guide: string): string[] {
  const list = /^required: (.*?)\. Optional:/.exec(guide)?.[1] ?? "";
  let depth = 0;
  let clean = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0) clean += ch;
  }
  return clean.split(",").map((part) => part.trim());
}

const create = (entity: string, value: Record<string, unknown>) =>
  call("create", { entity, fields: fields(value) });

describe("the create field guide matches what each route requires", () => {
  test("every required API field is marked required, or has a default the tool fills", () => {
    for (const [entity, def] of Object.entries(ENTITIES) as [
      EntityName,
      (typeof ENTITIES)[EntityName],
    ][]) {
      const shape = SCHEMAS[entity].shape as Record<string, z.ZodType>;
      const needed = Object.keys(shape).filter((key) => !shape[key]!.safeParse(undefined).success);
      const marked = requiredIn(def.fields).map((name) => API_KEY[name] ?? name);
      const filled = [
        ...Object.keys("defaults" in def ? def.defaults : {}),
        ...(RUNNER_FILLS[entity] ?? []),
      ];
      expect({
        entity,
        missing: needed.filter((key) => !marked.includes(key) && !filled.includes(key)),
      }).toEqual({
        entity,
        missing: [],
      });
    }
  });

  test("a habit, area, category and routine with only a name work the first time", async () => {
    const { ai, ctx, say } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          create("habit", { name: "Drink water", targetCount: 8 }),
          create("area", { name: "Health" }),
          create("category", { name: "Pets" }),
          create("routine", { name: "Morning" }),
        ],
      },
      { content: "Added them." },
    );
    const res = await say("add habit drink water 8 times a day, an area, a category and a routine");
    expect(res.events.filter((e) => e.type === "result").map((e) => e.ok)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    const habits = await ctx.request<{ name: string; targetCount: number; schedule: string }[]>(
      "GET",
      "/habits",
    );
    expect(habits.body.find((h) => h.name === "Drink water")).toMatchObject({
      targetCount: 8,
      schedule: "daily",
    });
  });

  test("a bill needs no kind, and an expense with no account goes to the default one", async () => {
    const { ai, ctx, say, system } = await setup();
    await ctx.request("POST", "/accounts", { name: "Cash", type: "cash" });
    const bkash = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "bKash",
      type: "mobile_wallet",
    });
    await ctx.request("PATCH", "/settings", { defaultAccountId: bkash.body.id });
    ai.queueChat(
      {
        toolCalls: [
          create("bill", {
            name: "Water bill",
            amount: 1200,
            rrule: "FREQ=MONTHLY;BYMONTHDAY=10",
            nextDueAt: "2026-10-10",
          }),
          create("transaction", { type: "expense", amount: 500 }),
        ],
      },
      { content: "Added." },
    );
    const res = await say("add water bill 1200 on the 10th monthly and expense 500");
    expect(res.body.actions).toHaveLength(2);
    expect(system()).toContain("Default account: bKash");
    expect(system()).toContain("never ask which account");
    const bills = await ctx.request<{ kind: string; name: string }[]>("GET", "/recurring");
    expect(bills.body.map((b) => [b.kind, b.name])).toEqual([["bill", "Water bill"]]);
    const spent = await ctx.request<{ items: { accountId: string }[] }>("GET", "/transactions");
    expect(spent.body.items.map((t) => t.accountId)).toEqual([bkash.body.id]);
  });
});
