import { addDays, parseLocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { hiddenAmount } from "@tick-taka/shared/money";
import { deferPastQuietHours, type QuietHours } from "@tick-taka/shared/quiet-hours";
import { formatAmount, plural } from "@/lib/format";

export interface PlannedNotification {
  id: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

/** A planned reminder before the cap; `filler` ones only use room the rest leave. */
export interface Candidate extends PlannedNotification {
  filler?: boolean;
}

export interface NotificationInputs {
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

/** How far ahead reminders are planned. */
export const HORIZON_MS = 30 * 86_400_000;

/**
 * Most one-off reminders the phone holds at once. Each is an Android alarm, and Android
 * stops an app at 500 (some phones sooner), so this stays well under it and keeps a
 * reschedule quick. The daily shutdown and weekly review repeat on their own and sit
 * outside the cap, as do the focus timer and pace alerts.
 */
export const MAX_SCHEDULED = 60;

/** Habit nudges are planned this many days ahead (today included). */
export const HABIT_DAYS = 7;

function atClock(date: string, clock: string, timeZone: string): number {
  const [hour, minute] = clock.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ ...parseLocalDate(date), hour, minute }, timeZone);
}

/**
 * Keeps at most `cap` reminders, nearest first. One-off reminders (tasks, bills, income,
 * loans) and habit nudges for today and tomorrow come first; habit nudges for later
 * days only fill the room left, so a week of habits can't push out a bill three weeks
 * away. The result is in time order.
 */
export function capNotifications(planned: Candidate[], cap: number): PlannedNotification[] {
  const byTime = (a: { at: number }, b: { at: number }) => a.at - b.at;
  const first = planned.filter((n) => !n.filler).sort(byTime);
  const fillers = planned.filter((n) => n.filler).sort(byTime);
  return [...first, ...fillers]
    .slice(0, Math.max(0, cap))
    .sort(byTime)
    .map(({ filler: _, ...n }) => n);
}

/**
 * Everything to schedule on the phone for the next 30 days, at most `cap` of them (see
 * capNotifications): task reminders, bills two days before and at 9 am on the day,
 * habit nudges for the coming week (today's only if not yet checked), debt reminders.
 * Quiet hours push anything inside the window to the morning.
 */
export function planNotifications(
  input: NotificationInputs,
  cap = MAX_SCHEDULED,
): PlannedNotification[] {
  const { now, timeZone } = input;
  const today = toLocalDate(now, timeZone);
  const planned: Candidate[] = [];
  const push = (n: PlannedNotification, filler = false) => {
    const at = deferPastQuietHours(n.at, input.quietHours, timeZone);
    if (at > now && at < now + HORIZON_MS) planned.push({ ...n, at, ...(filler && { filler }) });
  };

  for (const task of input.tasks) {
    if (task.reminderAt === null || task.status === "done") continue;
    push({
      id: `tt-task-${task.id}`,
      at: task.reminderAt,
      title: task.title,
      body: "Reminder",
      url: `/task/${task.id}`,
    });
  }
  for (const item of input.recurring) {
    const amount = input.hidden
      ? hiddenAmount(item.currency)
      : formatAmount(item.amountMinor, { currency: item.currency });
    const verb = item.kind === "bill" ? "due" : "expected";
    if (item.remindDays > 0) {
      push({
        id: `tt-bill-early-${item.id}`,
        at: atClock(addDays(item.dueDate, -item.remindDays), "09:00", timeZone),
        title: `${item.name} ${verb} in ${plural(item.remindDays, "day")}`,
        body: amount,
        url: `/money/recurring/${item.id}`,
      });
    }
    push({
      id: `tt-bill-day-${item.id}`,
      at: atClock(item.dueDate, "09:00", timeZone),
      title: `${item.name} ${verb} today`,
      body: amount,
      url: `/money/recurring/${item.id}`,
    });
  }
  for (const habit of input.habits) {
    const remindAt = habit.remindAt;
    if (!remindAt) continue;
    for (let day = habit.doneToday ? 1 : 0; day < HABIT_DAYS; day++)
      push(
        {
          id: `tt-habit-${habit.id}-${day}`,
          at: atClock(addDays(today, day), remindAt, timeZone),
          title: `${habit.emoji} ${habit.name}`,
          body: "A small one for today",
          url: "/plan/habits",
        },
        day > 1,
      );
  }
  for (const debt of input.debts) {
    if (debt.remindAt === null || debt.closedAt !== null) continue;
    push({
      id: `tt-debt-${debt.id}`,
      at: debt.remindAt,
      title: `Loan with ${debt.person}`,
      body: "A gentle reminder",
      url: "/money/debts",
    });
  }
  return capNotifications(planned, cap);
}
