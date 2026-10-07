import { isLocalDate, isLocalMonth, type LocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import type { SettingsKey } from "@tick-taka/shared/schemas/settings";
import type { Caller } from "./dispatch";
import { type createFieldConverter, project } from "./fields";
import { type Action, type DRAFTED, type Draft, isId, label, listOf, type Undo } from "./records";

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

/**
 * Settings the assistant may change. App lock, AI, and what decides the money totals
 * (currency, default and cash accounts, time zone) stay with the user in Settings, so
 * a misheard voice note or text inside a note can't change them.
 */
const ASSISTANT_SETTINGS = new Set<SettingsKey>([
  "theme",
  "numerals",
  "rewardTheme",
  "tikiOutfit",
  "weekStartsOn",
  "workdays",
  "dayCapacityMinutes",
  "dailyTaskGoal",
  "daysOff",
  "vacationMode",
  "advancedViews",
  "focus",
  "quietHours",
  "shutdownTime",
  "weeklyReviewDay",
  "weeklyReviewTime",
  "costInHours",
  "costInHoursThresholdMinor",
  "billOverdueGraceDays",
  "weeklyFocus",
]);

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
    // Like Today's "Paid": one write that needs nothing from the pay's reply.
    const undo: Undo | undefined =
      body.dueAt === undefined
        ? undefined
        : {
            method: "POST",
            path: `${billPath}/unpay`,
            body: {
              transactionId: body.transactionId,
              dueAt: body.dueAt,
              skip: (body as { skip?: unknown }).skip === true,
            },
          };
    if (drafting)
      return propose({
        summary: `${raw.skip ? "Skip" : "Pay"} ${label(bill, "a bill")}`,
        method: "POST",
        path,
        body,
        ...(undo ? { undo } : {}),
      });
    const result = await caller.call("POST", path, body);
    if (!result.ok) return fail(result.error);
    actions.push({
      summary: raw.skip
        ? "Skipped this bill"
        : `Paid ${label(result.data as Record<string, unknown>, "bill")}`,
      ...(undo ? { undo } : {}),
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
    if (!isId(categoryId)) return fail("set_budget needs a category");
    const current = (await caller.call("GET", `/budgets?month=${month}`)).data as {
      lines?: {
        categoryId: string;
        name?: string;
        limitMinor: number;
        rollover?: boolean;
        hasBudget?: boolean;
      }[];
    } | null;
    const existing = current?.lines?.find((line) => line.categoryId === categoryId);
    const before = existing?.hasBudget
      ? { limitMinor: existing.limitMinor, rollover: existing.rollover ?? false }
      : { limitMinor: null };
    const setting = Number(limitMinor) > 0;
    // Only this line is written, so a draft saved days later (or its Undo) leaves the
    // month's other lines as they are by then. Changing the amount keeps the line's
    // rollover as the user set it.
    const path = `/budgets/${month}/${categoryId}`;
    const body = { limitMinor: setting ? limitMinor : null };
    const summary = `${setting ? "Set" : "Remove"} the ${existing?.name ? `${existing.name} ` : ""}budget for ${month}`;
    const undo: Undo = { method: "PUT", path, body: before };
    if (drafting)
      return propose({
        summary,
        method: "PUT",
        path,
        body,
        undo,
        ...(typeof limitMinor === "number" ? { amountMinor: limitMinor } : {}),
        categoryId,
      });
    const result = await caller.call("PUT", path, body);
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
    const keys = Object.keys(raw);
    const refused = keys.filter((key) => !ASSISTANT_SETTINGS.has(key as SettingsKey));
    if (keys.length === 0 || refused.length > 0)
      return fail(
        `Only the user can change ${refused.join(", ") || "that"}, in the app's Settings. Tiki can change: ${[...ASSISTANT_SETTINGS].join(", ")}.`,
      );
    const current = await caller.call("GET", "/settings");
    if (!current.ok) return fail(current.error);
    const before = (current.data ?? {}) as Record<string, unknown>;
    // Turning vacation mode on or off also opens or closes a vacation period.
    const restored = "vacationMode" in raw && !("vacations" in raw) ? [...keys, "vacations"] : keys;
    const undo: Undo = {
      method: "PATCH",
      path: "/settings",
      body: Object.fromEntries(restored.map((key) => [key, before[key]])),
    };
    const result = await caller.call("PATCH", "/settings", raw);
    if (!result.ok) return fail(result.error);
    actions.push({ summary: `Changed settings: ${keys.join(", ")}`, undo });
    return { ok: true };
  },
};
