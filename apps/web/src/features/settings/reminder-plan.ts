import { addDays, parseLocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { hiddenAmount } from "@tick-taka/shared/money";
import {
  deferPastQuietHours,
  isInQuietHours,
  type QuietHours,
} from "@tick-taka/shared/quiet-hours";
import { formatAmount, plural } from "@/lib/format";

/**
 * The phone's reminder plan (apps/mobile/src/features/notifications), for browser
 * notifications while a tab is open: task reminders, bills two days before and at
 * 9 am on the day, habit nudges not yet checked, debt reminders, and the monthly pace
 * alert. Pure, so it can be tested; the tab's timers live in use-planned-reminders.
 */

/** Where a click goes: a route, and the panel to open over it. */
export interface ReminderTarget {
  to: string;
  panel?: string;
}

export interface PlannedReminder {
  id: string;
  at: number;
  title: string;
  body: string;
  target: ReminderTarget;
}

export interface ReminderInputs {
  now: number;
  timeZone: string;
  quietHours: QuietHours;
  /** Hide amounts is on: bills and income say "৳•••" instead of the figure. */
  hidden?: boolean;
  tasks: { id: string; title: string; reminderAt: number | null; status: string }[];
  recurring: {
    id: string;
    kind: string;
    name: string;
    amountMinor: number;
    currency: string;
    dueDate: string;
    remindDays: number;
  }[];
  habits: {
    id: string;
    name: string;
    emoji: string;
    remindAt: string | null;
    doneToday: boolean;
  }[];
  debts: { id: string; person: string; remindAt: number | null; closedAt: number | null }[];
}

const DAY_MS = 86_400_000;
const HORIZON_MS = 7 * DAY_MS;

/**
 * Which tasks to fetch: every open or inbox task (subtasks too) whose reminder rings
 * in the next eight days, picked by reminderAt rather than doAt, so an undated inbox
 * task with a reminder still rings. The phone's reminderQuery.
 */
export const REMINDER_LOOKAHEAD_MS = 8 * DAY_MS;

export function reminderQuery(now: number) {
  return {
    status: "inbox,open",
    reminderFrom: String(now),
    reminderTo: String(now + REMINDER_LOOKAHEAD_MS),
    includeSubtasks: "true" as const,
    limit: "500",
  };
}

function atClock(date: string, clock: string, timeZone: string): number {
  const [hour, minute] = clock.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ ...parseLocalDate(date), hour, minute }, timeZone);
}

/**
 * Everything that should ring in the next week, after `now`, soonest first. Quiet
 * hours push anything inside the window to the morning. A habit nudge's id carries
 * its day, so the same nudge planned before and after midnight is one reminder.
 */
export function planReminders(input: ReminderInputs): PlannedReminder[] {
  const { now, timeZone } = input;
  const today = toLocalDate(now, timeZone);
  const planned: PlannedReminder[] = [];
  const push = (n: PlannedReminder) => {
    const at = deferPastQuietHours(n.at, input.quietHours, timeZone);
    if (at > now && at < now + HORIZON_MS) planned.push({ ...n, at });
  };

  for (const task of input.tasks) {
    if (task.reminderAt === null || task.status === "done") continue;
    push({
      id: `tt-task-${task.id}`,
      at: task.reminderAt,
      title: task.title,
      body: "Reminder",
      target: { to: "/", panel: `task:${task.id}` },
    });
  }
  for (const item of input.recurring) {
    const amount = input.hidden
      ? hiddenAmount(item.currency)
      : formatAmount(item.amountMinor, { currency: item.currency });
    const verb = item.kind === "bill" ? "due" : "expected";
    const target = { to: "/money/bills", panel: `recurring:${item.id}` };
    if (item.remindDays > 0) {
      push({
        id: `tt-bill-early-${item.id}`,
        at: atClock(addDays(item.dueDate, -item.remindDays), "09:00", timeZone),
        title: `${item.name} ${verb} in ${plural(item.remindDays, "day")}`,
        body: amount,
        target,
      });
    }
    push({
      id: `tt-bill-day-${item.id}`,
      at: atClock(item.dueDate, "09:00", timeZone),
      title: `${item.name} ${verb} today`,
      body: amount,
      target,
    });
  }
  for (const habit of input.habits) {
    if (!habit.remindAt) continue;
    const nudge = (date: string): PlannedReminder => ({
      id: `tt-habit-${habit.id}-${date}`,
      at: atClock(date, habit.remindAt as string, timeZone),
      title: `${habit.emoji} ${habit.name}`,
      body: "A small one for today",
      target: { to: "/plan/habits", panel: `habit:${habit.id}` },
    });
    if (!habit.doneToday) push(nudge(today));
    push(nudge(addDays(today, 1)));
  }
  for (const debt of input.debts) {
    if (debt.remindAt === null || debt.closedAt !== null) continue;
    push({
      id: `tt-debt-${debt.id}`,
      at: debt.remindAt,
      title: `Loan with ${debt.person}`,
      body: "A gentle reminder",
      target: { to: "/money/debts" },
    });
  }
  return planned.sort((a, b) => a.at - b.at);
}

/**
 * A tab asleep (a closed laptop) wakes with its timers late; a reminder more than
 * this late is dropped rather than rung out of context.
 */
export const LATE_LIMIT_MS = 30 * 60_000;

/** The reminders that came due since the last check, `since` < at <= `now`. */
export function dueReminders(
  plan: PlannedReminder[],
  since: number,
  now: number,
): PlannedReminder[] {
  return plan.filter((n) => n.at > since && n.at <= now && now - n.at <= LATE_LIMIT_MS);
}

/** setTimeout can't wait longer than about 24.8 days; check again well before that. */
export const MAX_WAIT_MS = 6 * 3_600_000;

/** How long to wait before the next check: the soonest reminder, or MAX_WAIT_MS. */
export function nextCheckIn(plan: PlannedReminder[], now: number): number {
  const next = plan.find((n) => n.at > now);
  return next ? Math.min(Math.max(next.at - now, 1000), MAX_WAIT_MS) : MAX_WAIT_MS;
}

export interface PaceAlert {
  categoryId: string;
  name: string;
  emoji: string;
}

/**
 * The pace alert: one calm heads-up per category per month, never a stream (keyed by
 * month and category, like the phone). Held back during quiet hours; the next Today
 * refresh after they end sends it.
 */
export function paceReminder(
  pace: PaceAlert | null | undefined,
  date: string,
  now: number,
  quietHours: QuietHours,
  timeZone: string,
): { key: string; title: string; body: string; target: ReminderTarget } | null {
  if (!pace || isInQuietHours(now, quietHours, timeZone)) return null;
  return {
    key: `tt-pace-${date.slice(0, 7)}:${pace.categoryId}`,
    title: `${pace.emoji} ${pace.name} is running ahead`,
    body: "A small heads-up from Tiki. Plenty of month left to even it out.",
    target: { to: "/money/budgets" },
  };
}

/**
 * The ledger of reminders already rung in this browser, shared by its tabs: key →
 * when the entry may be forgotten. Claiming a key that is already there fails, so a
 * second tab stays quiet. Expired entries are dropped as it is written back.
 */
export function claimInLedger(
  raw: string | null,
  key: string,
  keepUntil: number,
  now: number,
): { claimed: boolean; next: string } {
  let ledger: Record<string, number> = {};
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ledger = parsed as Record<string, number>;
  } catch {}
  const kept = Object.fromEntries(
    Object.entries(ledger).filter(([, until]) => typeof until === "number" && until > now),
  );
  if (key in kept) return { claimed: false, next: JSON.stringify(kept) };
  return { claimed: true, next: JSON.stringify({ ...kept, [key]: keepUntil }) };
}
