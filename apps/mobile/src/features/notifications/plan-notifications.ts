import { addDays, parseLocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { deferPastQuietHours, type QuietHours } from "@tick-taka/shared/quiet-hours";
import { formatAmount } from "@/lib/format";

export interface PlannedNotification {
  id: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

export interface NotificationInputs {
  now: number;
  timeZone: string;
  quietHours: QuietHours;
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

const HORIZON_MS = 7 * 86_400_000;

function atClock(date: string, clock: string, timeZone: string): number {
  const [hour, minute] = clock.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ ...parseLocalDate(date), hour, minute }, timeZone);
}

/**
 * Everything to schedule on the phone for the next week: task reminders, bills two
 * days before and at 9 am on the day, habit nudges not yet checked, debt reminders.
 * Quiet hours push anything inside the window to the morning.
 */
export function planNotifications(input: NotificationInputs): PlannedNotification[] {
  const { now, timeZone } = input;
  const today = toLocalDate(now, timeZone);
  const planned: PlannedNotification[] = [];
  const push = (n: PlannedNotification) => {
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
      url: `/task/${task.id}`,
    });
  }
  for (const item of input.recurring) {
    const amount = formatAmount(item.amountMinor, { currency: item.currency });
    const verb = item.kind === "bill" ? "due" : "expected";
    if (item.remindDays > 0) {
      push({
        id: `tt-bill-early-${item.id}`,
        at: atClock(addDays(item.dueDate, -item.remindDays), "09:00", timeZone),
        title: `${item.name} ${verb} in ${item.remindDays} day${item.remindDays === 1 ? "" : "s"}`,
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
    if (!habit.remindAt) continue;
    if (!habit.doneToday)
      push({
        id: `tt-habit-${habit.id}-0`,
        at: atClock(today, habit.remindAt, timeZone),
        title: `${habit.emoji} ${habit.name}`,
        body: "A small one for today",
        url: "/plan/habits",
      });
    push({
      id: `tt-habit-${habit.id}-1`,
      at: atClock(addDays(today, 1), habit.remindAt, timeZone),
      title: `${habit.emoji} ${habit.name}`,
      body: "A small one for today",
      url: "/plan/habits",
    });
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
  return planned.sort((a, b) => a.at - b.at);
}
