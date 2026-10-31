import { expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  claimInLedger,
  dueReminders,
  LATE_LIMIT_MS,
  MAX_WAIT_MS,
  nextCheckIn,
  type PlannedReminder,
  paceReminder,
  planReminders,
  type ReminderInputs,
  reminderQuery,
} from "../src/features/settings/reminder-plan";

const DHAKA = "Asia/Dhaka";
const QUIET = { start: "23:00", end: "07:00" };
const at = (month: number, day: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute }, DHAKA);
// Friday 30 Oct 2026, 10:00 in Dhaka.
const NOW = at(10, 30, 10);

const base = (over: Partial<ReminderInputs> = {}): ReminderInputs => ({
  now: NOW,
  timeZone: DHAKA,
  quietHours: QUIET,
  tasks: [],
  recurring: [],
  habits: [],
  debts: [],
  ...over,
});

test("tasks are fetched by when their reminder rings, eight days ahead", () => {
  expect(reminderQuery(NOW)).toEqual({
    status: "inbox,open",
    reminderFrom: String(NOW),
    reminderTo: String(NOW + 8 * 86_400_000),
    includeSubtasks: "true",
    limit: "500",
  });
});

test("a task reminder opens the task panel; done, past and unset ones don't ring", () => {
  const plan = planReminders(
    base({
      tasks: [
        { id: "a", title: "Call the bank", reminderAt: at(10, 30, 15), status: "open" },
        { id: "b", title: "Done already", reminderAt: at(10, 30, 16), status: "done" },
        { id: "c", title: "Earlier", reminderAt: at(10, 30, 9), status: "open" },
        { id: "d", title: "No reminder", reminderAt: null, status: "inbox" },
        { id: "e", title: "Too far", reminderAt: at(11, 7, 10), status: "open" },
      ],
    }),
  );
  expect(plan).toEqual([
    {
      id: "tt-task-a",
      at: at(10, 30, 15),
      title: "Call the bank",
      body: "Reminder",
      target: { to: "/", panel: "task:a" },
    },
  ]);
});

test("quiet hours push a reminder to the morning", () => {
  const plan = planReminders(
    base({ tasks: [{ id: "a", title: "Late", reminderAt: at(10, 30, 23, 30), status: "open" }] }),
  );
  expect(plan[0]?.at).toBe(at(10, 31, 7));
});

test("bills and income ring days before and on the day at 9 am, soonest first", () => {
  const plan = planReminders(
    base({
      recurring: [
        {
          id: "r1",
          kind: "bill",
          name: "Rent",
          amountMinor: 1_500_000,
          currency: "BDT",
          dueDate: "2026-11-03",
          remindDays: 2,
        },
        {
          id: "r2",
          kind: "income",
          name: "Salary",
          amountMinor: 5_000_000,
          currency: "BDT",
          dueDate: "2026-10-31",
          remindDays: 1,
        },
      ],
    }),
  );
  // Salary's day-before reminder (30 Oct, 9 am) has passed.
  expect(plan.map((n) => [n.id, n.at, n.title])).toEqual([
    ["tt-bill-day-r2", at(10, 31, 9), "Salary expected today"],
    ["tt-bill-early-r1", at(11, 1, 9), "Rent due in 2 days"],
    ["tt-bill-day-r1", at(11, 3, 9), "Rent due today"],
  ]);
  expect(plan[0]?.target).toEqual({ to: "/money/bills", panel: "recurring:r2" });
  expect(plan[0]?.body).toContain("50,000");
});

test("Hide amounts keeps the figure out of bill and income reminders", () => {
  const plan = planReminders(
    base({
      hidden: true,
      recurring: [
        {
          id: "r1",
          kind: "bill",
          name: "Rent",
          amountMinor: 1_500_000,
          currency: "BDT",
          dueDate: "2026-11-03",
          remindDays: 2,
        },
      ],
    }),
  );
  expect(plan.map((n) => n.body)).toEqual(["৳•••", "৳•••"]);
});

test("a habit nudges today only if not done, and tomorrow either way", () => {
  const habit = { id: "h", name: "Read", emoji: "📚", remindAt: "20:00" };
  const open = planReminders(base({ habits: [{ ...habit, doneToday: false }] }));
  expect(open.map((n) => [n.id, n.at])).toEqual([
    ["tt-habit-h-2026-10-30", at(10, 30, 20)],
    ["tt-habit-h-2026-10-31", at(10, 31, 20)],
  ]);
  expect(open[0]).toMatchObject({
    title: "📚 Read",
    body: "A small one for today",
    target: { to: "/plan/habits", panel: "habit:h" },
  });
  const done = planReminders(base({ habits: [{ ...habit, doneToday: true }] }));
  expect(done.map((n) => n.id)).toEqual(["tt-habit-h-2026-10-31"]);
  // Planned before and after midnight, tomorrow's nudge is the same reminder.
  const nextDay = planReminders(
    base({ now: at(10, 31, 1), habits: [{ ...habit, doneToday: false }] }),
  );
  expect(nextDay[0]?.id).toBe("tt-habit-h-2026-10-31");
});

test("debt reminders skip closed loans and open the debts view", () => {
  const plan = planReminders(
    base({
      debts: [
        { id: "d1", person: "Rafi", remindAt: at(10, 31, 12), closedAt: null },
        { id: "d2", person: "Nila", remindAt: at(10, 31, 12), closedAt: NOW - 1 },
      ],
    }),
  );
  expect(plan).toEqual([
    {
      id: "tt-debt-d1",
      at: at(10, 31, 12),
      title: "Loan with Rafi",
      body: "A gentle reminder",
      target: { to: "/money/debts" },
    },
  ]);
});

const reminder = (id: string, when: number): PlannedReminder => ({
  id,
  at: when,
  title: id,
  body: "",
  target: { to: "/" },
});

test("due reminders are the ones since the last check, unless very late", () => {
  const plan = [reminder("a", NOW - 1000), reminder("b", NOW + 60_000), reminder("c", NOW)];
  expect(dueReminders(plan, NOW - 5000, NOW).map((n) => n.id)).toEqual(["a", "c"]);
  // Already checked at NOW - 1000: "a" doesn't ring twice.
  expect(dueReminders(plan, NOW - 1000, NOW).map((n) => n.id)).toEqual(["c"]);
  // A tab that slept drops what it missed by more than the limit ("b" is just in it).
  const late = NOW + LATE_LIMIT_MS + 1;
  expect(dueReminders(plan, NOW - 5000, late).map((n) => n.id)).toEqual(["b"]);
});

test("the next check waits for the soonest reminder, at most a few hours", () => {
  expect(nextCheckIn([reminder("a", NOW + 60_000)], NOW)).toBe(60_000);
  expect(nextCheckIn([reminder("a", NOW + 10)], NOW)).toBe(1000);
  expect(nextCheckIn([reminder("a", NOW - 10)], NOW)).toBe(MAX_WAIT_MS);
  expect(nextCheckIn([reminder("a", NOW + 2 * 86_400_000)], NOW)).toBe(MAX_WAIT_MS);
});

test("the pace alert is keyed by month and category and waits out quiet hours", () => {
  const pace = { categoryId: "food", name: "Food", emoji: "🍜" };
  expect(paceReminder(pace, "2026-10-30", NOW, QUIET, DHAKA)).toEqual({
    key: "tt-pace-2026-10:food",
    title: "🍜 Food is running ahead",
    body: "A small heads-up from Tiki. Plenty of month left to even it out.",
    target: { to: "/money/budgets" },
  });
  expect(paceReminder(pace, "2026-10-30", at(10, 30, 23, 30), QUIET, DHAKA)).toBeNull();
  expect(paceReminder(null, "2026-10-30", NOW, QUIET, DHAKA)).toBeNull();
});

test("the ledger lets one tab claim a reminder and forgets expired entries", () => {
  const first = claimInLedger(null, "tt-task-a@1", NOW + 1000, NOW);
  expect(first.claimed).toBe(true);
  const second = claimInLedger(first.next, "tt-task-a@1", NOW + 1000, NOW);
  expect(second.claimed).toBe(false);
  // After it expires the entry is dropped, and a new key is claimed.
  const later = claimInLedger(first.next, "tt-task-b@2", NOW + 5000, NOW + 2000);
  expect(later.claimed).toBe(true);
  expect(JSON.parse(later.next)).toEqual({ "tt-task-b@2": NOW + 5000 });
  expect(claimInLedger("{broken", "k", NOW + 1, NOW).claimed).toBe(true);
  expect(claimInLedger("[1]", "k", NOW + 1, NOW).claimed).toBe(true);
});
