import { describe, expect, test } from "bun:test";
import { ACTION_HANDLERS, type ActionContext } from "../src/modules/ai/assistant/actions";
import type { Caller } from "../src/modules/ai/assistant/dispatch";
import type { Action, Draft } from "../src/modules/ai/assistant/records";

const ID = "01K0000000000000000000000A";
const NOW = Date.UTC(2026, 9, 4, 6);

interface Sent {
  method: string;
  path: string;
  body?: unknown;
}

/** A tool-runner context whose REST calls are recorded and answered by `reply`. */
function context(options: { drafting?: boolean; reply?: (sent: Sent) => unknown } = {}) {
  const sent: Sent[] = [];
  const actions: Action[] = [];
  const drafts: Draft[] = [];
  const caller: Caller = {
    async call(method, path, body) {
      const request = { method, path, body };
      sent.push(request);
      const data = options.reply?.(request) ?? { id: ID };
      return data instanceof Error
        ? { ok: false, status: 400, data: null, error: data.message }
        : { ok: true, status: 200, data };
    },
  };
  const ctx: ActionContext = {
    caller,
    convert: async (fields) => fields,
    timeZone: "Asia/Dhaka",
    now: NOW,
    today: "2026-10-04",
    drafting: options.drafting ?? false,
    propose: (draft) => {
      drafts.push(draft);
      return { ok: true, draft: true, note: "" };
    },
    fail: (error) => ({ error: error ?? "That didn't work" }),
    actions,
  };
  return { ctx, sent, actions, drafts };
}

const needId = () => ID;

describe("assistant money actions", () => {
  test.each([
    ["contribute_goal", `/goals/${ID}/contribute`, "Add to a goal"],
    ["repay_debt", `/debts/${ID}/repay`, "Record a debt repayment"],
    ["check_balance", `/accounts/${ID}/balance-check`, "Match an account balance"],
  ] as const)("%s posts with a fresh id when saving directly", async (name, path) => {
    const { ctx, sent, actions } = context();
    const result = await ACTION_HANDLERS[name](ctx, { amountMinor: 50000 }, needId);
    expect(result).toMatchObject({ ok: true });
    expect(sent).toEqual([
      { method: "POST", path, body: { id: expect.any(String), amountMinor: 50000 } },
    ]);
    expect(actions).toHaveLength(1);
  });

  test.each([
    ["contribute_goal", "Add to a goal"],
    ["repay_debt", "Record a debt repayment"],
    ["check_balance", "Match an account balance"],
    ["checkout_shopping", "Check out the shopping list"],
  ] as const)("%s only proposes a draft when drafting", async (name, summary) => {
    const { ctx, sent, drafts } = context({ drafting: true });
    const result = await ACTION_HANDLERS[name](ctx, { amountMinor: 1000 }, needId);
    expect(result).toMatchObject({ draft: true });
    expect(sent).toEqual([]);
    expect(drafts).toEqual([expect.objectContaining({ summary, method: "POST" })]);
  });

  test("checkout_shopping sends one transaction id", async () => {
    const { ctx, sent, actions } = context();
    await ACTION_HANDLERS.checkout_shopping(ctx, { accountId: ID }, needId);
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/shopping/checkout",
        body: { transactionId: expect.any(String), accountId: ID },
      },
    ]);
    expect(actions[0]?.summary).toBe("Checked out the shopping list");
  });

  test("a refused request is reported, not recorded as done", async () => {
    const { ctx, actions } = context({ reply: () => new Error("Goal is closed") });
    const result = await ACTION_HANDLERS.contribute_goal(ctx, { amountMinor: 1 }, needId);
    expect(result).toEqual({ error: "Goal is closed" });
    expect(actions).toEqual([]);
  });
});

describe("assistant timer and settings actions", () => {
  test("start_timer starts at the turn's time with a new entry id", async () => {
    const { ctx, sent, actions } = context();
    await ACTION_HANDLERS.start_timer(ctx, { note: "thesis" }, needId);
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/timer/start",
        body: { id: expect.any(String), source: "timer", startedAt: NOW, note: "thesis" },
      },
    ]);
    expect(actions[0]?.summary).toBe("Started the timer");
  });

  test("stop_timer stops at the turn's time", async () => {
    const { ctx, sent } = context();
    await ACTION_HANDLERS.stop_timer(ctx, {}, needId);
    expect(sent).toEqual([{ method: "POST", path: "/timer/stop", body: { endedAt: NOW } }]);
  });

  const settingsReply = (sent: Sent) =>
    sent.method === "GET"
      ? { theme: "light", dailyTaskGoal: 5, vacationMode: false, vacations: [], appLock: true }
      : { id: ID };

  test("update_settings patches exactly the fields asked for, with an Undo to the old values", async () => {
    const { ctx, sent, actions } = context({ reply: settingsReply });
    await ACTION_HANDLERS.update_settings(ctx, { theme: "dark", dailyTaskGoal: 4 }, needId);
    expect(sent.filter((r) => r.method === "PATCH")).toEqual([
      { method: "PATCH", path: "/settings", body: { theme: "dark", dailyTaskGoal: 4 } },
    ]);
    expect(actions).toEqual([
      {
        summary: "Changed settings: theme, dailyTaskGoal",
        undo: { method: "PATCH", path: "/settings", body: { theme: "light", dailyTaskGoal: 5 } },
      },
    ]);
  });

  // QA-306: a mis-heard voice note must not turn App lock off or move money totals.
  test.each([
    { appLock: false },
    { lockAfterMinutes: 60 },
    { ai: { enabled: false, features: {} } },
    { defaultCurrency: "USD" },
    { defaultAccountId: ID },
    { timeZone: "Europe/London" },
    { theme: "dark", appLock: false },
    { madeUp: true },
  ])("update_settings refuses %o and changes nothing", async (fields) => {
    const { ctx, sent, actions } = context({ reply: settingsReply });
    const result = await ACTION_HANDLERS.update_settings(ctx, fields, needId);
    expect(result).toMatchObject({ error: expect.stringContaining("in the app") });
    expect(sent.filter((r) => r.method === "PATCH")).toEqual([]);
    expect(actions).toEqual([]);
  });

  test("undoing vacation mode also puts the vacation list back", async () => {
    const { ctx, actions } = context({ reply: settingsReply });
    await ACTION_HANDLERS.update_settings(ctx, { vacationMode: true }, needId);
    expect(actions[0]?.undo).toEqual({
      method: "PATCH",
      path: "/settings",
      body: { vacationMode: false, vacations: [] },
    });
  });

  test("a refused settings change is reported", async () => {
    const { ctx, actions } = context({
      reply: (sent) => (sent.method === "PATCH" ? new Error("Invalid time") : settingsReply(sent)),
    });
    const result = await ACTION_HANDLERS.update_settings(
      ctx,
      { weeklyReviewTime: "25:00" },
      needId,
    );
    expect(result).toEqual({ error: "Invalid time" });
    expect(actions).toEqual([]);
  });
});
