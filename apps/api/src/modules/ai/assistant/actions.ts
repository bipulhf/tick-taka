import { isLocalDate, isLocalMonth, type LocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import type { Caller } from "./dispatch";
import { type createFieldConverter, project } from "./fields";
import { type Action, type DRAFTED, type Draft, label, listOf, type Undo } from "./records";

export const ACTIONS = [
  "log_habit",
  "pay_bill",
  "contribute_goal",
  "repay_debt",
  "check_balance",
  "start_timer",
  "stop_timer",
  "set_budget",
  "checkout_shopping",
  "update_settings",
] as const;
export type ActionName = (typeof ACTIONS)[number];

/** What every action handler can use from the turn's tool runner. */
export interface ActionContext {
  caller: Caller;
  convert: ReturnType<typeof createFieldConverter>;
  timeZone: string;
  now: number;
  today: LocalDate;
  /** Money changes become drafts for the user to confirm instead of being sent. */
  drafting: boolean;
  propose: (draft: Draft) => typeof DRAFTED;
  fail: (error: string | undefined) => { error: string };
  /** Changes made this turn, each with its Undo. */
  actions: Action[];
}

type ActionHandler = (
  ctx: ActionContext,
  raw: Record<string, unknown>,
  needId: () => string,
) => Promise<unknown>;

/** The `act` tool's actions, one handler each. */
export const ACTION_HANDLERS: Record<ActionName, ActionHandler> = {
  log_habit: async ({ caller, today, fail, actions }, raw, needId) => {
    const habitId = needId();
    const date = typeof raw.date === "string" && isLocalDate(raw.date) ? raw.date : today;
    const habits = listOf((await caller.call("GET", `/habits?date=${date}`)).data);
    const habit = habits.find((h) => h.id === habitId);
    const previous = typeof habit?.todayCount === "number" ? habit.todayCount : 0;
    const count = typeof raw.count === "number" ? raw.count : previous + 1;
    const result = await caller.call("PUT", `/habits/${habitId}/logs/${date}`, { count });
    if (!result.ok) return fail(result.error);
    actions.push({
      summary: `Logged ${label(habit, "habit")} (${count}${typeof habit?.targetCount === "number" ? `/${habit.targetCount}` : ""})`,
      undo: {
        method: "PUT",
        path: `/habits/${habitId}/logs/${date}`,
        body: { count: previous },
      },
    });
    return { ok: true, count };
  },
  pay_bill: async ({ caller, convert, now, drafting, propose, fail, actions }, raw, needId) => {
    const billPath = `/recurring/${needId()}`;
    const found = await caller.call("GET", billPath);
    if (!found.ok) return fail(found.error);
    const bill = found.data as { nextDueAt?: unknown } & Record<string, unknown>;
    // The due date it pays: saving the draft after the bill was paid another way
    // (Today's "Paid") then changes nothing instead of paying the next period.
    const body = {
      transactionId: newId(now),
      ...(await convert(raw)),
      ...(typeof bill.nextDueAt === "number" ? { dueAt: bill.nextDueAt } : {}),
    };
    const path = `${billPath}/pay`;
    if (drafting)
      return propose({
        summary: `${raw.skip ? "Skip" : "Pay"} ${label(bill, "a bill")}`,
        method: "POST",
        path,
        body,
      });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({
      summary: raw.skip
        ? "Skipped this bill"
        : `Paid ${label(result.data as Record<string, unknown>, "bill")}`,
    });
    return { ok: true };
  },
  contribute_goal: async (
    { caller, convert, now, drafting, propose, fail, actions },
    raw,
    needId,
  ) => {
    const body = { id: newId(now), ...(await convert(raw)) };
    const path = `/goals/${needId()}/contribute`;
    if (drafting) return propose({ summary: "Add to a goal", method: "POST", path, body });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({
      summary: `Added to goal ${label(result.data as Record<string, unknown>, "")}`.trim(),
    });
    return { ok: true };
  },
  repay_debt: async ({ caller, convert, now, drafting, propose, fail, actions }, raw, needId) => {
    const body = { id: newId(now), ...(await convert(raw)) };
    const path = `/debts/${needId()}/repay`;
    if (drafting)
      return propose({ summary: "Record a debt repayment", method: "POST", path, body });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({ summary: "Recorded a debt repayment" });
    return { ok: true };
  },
  check_balance: async (
    { caller, convert, timeZone, now, drafting, propose, fail, actions },
    raw,
    needId,
  ) => {
    const body = { id: newId(now), ...(await convert(raw)) };
    const path = `/accounts/${needId()}/balance-check`;
    if (drafting)
      return propose({ summary: "Match an account balance", method: "POST", path, body });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({ summary: "Matched the account balance" });
    return { ok: true, result: project(result.data, timeZone) };
  },
  start_timer: async ({ caller, convert, now, fail, actions }, raw, _needId) => {
    const body = await convert(raw);
    const result = await caller.call("POST", "/timer/start", {
      id: newId(now),
      source: "timer",
      startedAt: now,
      ...body,
    });
    if (!result.ok) return fail(result.error);
    actions.push({ summary: "Started the timer" });
    return { ok: true };
  },
  stop_timer: async ({ caller, now, fail, actions }, _raw, _needId) => {
    const result = await caller.call("POST", "/timer/stop", { endedAt: now });
    if (!result.ok) return fail(result.error);
    actions.push({ summary: "Stopped the timer" });
    return { ok: true };
  },
  set_budget: async (
    { caller, convert, today, drafting, propose, fail, actions },
    raw,
    _needId,
  ) => {
    const month =
      typeof raw.month === "string" && isLocalMonth(raw.month) ? raw.month : today.slice(0, 7);
    const { categoryId, limitMinor } = await convert({
      category: raw.category,
      limit: raw.limit,
    });
    const current = (await caller.call("GET", `/budgets?month=${month}`)).data as {
      lines?: {
        categoryId: string;
        name?: string;
        limitMinor: number;
        rollover?: boolean;
        hasBudget?: boolean;
      }[];
    } | null;
    const lines = (current?.lines ?? []).filter((line) => line.hasBudget);
    const asSent = (line: (typeof lines)[number]) => ({
      categoryId: line.categoryId,
      limitMinor: line.limitMinor,
      rollover: line.rollover ?? false,
    });
    const previous = lines.map(asSent);
    const kept = previous.filter((line) => line.categoryId !== categoryId);
    // Changing the amount leaves the line's rollover as the user set it.
    const rollover = previous.find((line) => line.categoryId === categoryId)?.rollover ?? false;
    const setting = Number(limitMinor) > 0;
    const budgets = setting ? [...kept, { categoryId, limitMinor, rollover }] : kept;
    const name = current?.lines?.find((line) => line.categoryId === categoryId)?.name;
    const summary = `${setting ? "Set" : "Remove"} the ${name ? `${name} ` : ""}budget for ${month}`;
    const undo: Undo = { method: "PUT", path: "/budgets", body: { month, budgets: previous } };
    if (drafting)
      return propose({
        summary,
        method: "PUT",
        path: "/budgets",
        body: { month, budgets },
        undo,
        ...(typeof limitMinor === "number" ? { amountMinor: limitMinor } : {}),
        ...(typeof categoryId === "string" ? { categoryId } : {}),
      });
    const result = await caller.call("PUT", "/budgets", { month, budgets });
    if (!result.ok) return fail(result.error);
    actions.push({
      summary: setting ? `Set a ${month} budget` : `Removed a ${month} budget`,
      undo,
    });
    return { ok: true };
  },
  checkout_shopping: async (
    { caller, convert, now, drafting, propose, fail, actions },
    raw,
    _needId,
  ) => {
    const body = { transactionId: newId(now), ...(await convert(raw)) };
    const path = "/shopping/checkout";
    if (drafting)
      return propose({ summary: "Check out the shopping list", method: "POST", path, body });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({ summary: "Checked out the shopping list" });
    return { ok: true };
  },
  update_settings: async ({ caller, fail, actions }, raw, _needId) => {
    const result = await caller.call("PATCH", "/settings", raw);
    if (!result.ok) return fail(result.error);
    actions.push({ summary: `Changed settings: ${Object.keys(raw).join(", ")}` });
    return { ok: true };
  },
};
