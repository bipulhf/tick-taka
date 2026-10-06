import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { planNotifications } from "../src/features/notifications/plan-notifications";
import {
  REMINDER_LOOKAHEAD_MS,
  reminderQuery,
  rescheduleDue,
} from "../src/features/notifications/reminder-window";

const TZ = "Asia/Dhaka";
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 10 }, TZ);

describe("which tasks get phone reminders", () => {
  test("tasks are picked by when the reminder rings, not by their day", () => {
    const query = reminderQuery(now);
    expect(query).toMatchObject({
      status: "inbox,open",
      reminderFrom: String(now),
      reminderTo: String(now + REMINDER_LOOKAHEAD_MS),
      includeSubtasks: "true",
    });
    expect(query).not.toHaveProperty("from");
    expect(query).not.toHaveProperty("to");
  });

  test("an inbox task with a reminder tomorrow and no day still rings", () => {
    const tomorrow = zonedTimeToUtc({ year: 2026, month: 10, day: 7, hour: 9 }, TZ);
    const planned = planNotifications({
      now,
      timeZone: TZ,
      quietHours: { start: "23:00", end: "07:00" },
      tasks: [{ id: "t1", title: "Call the bank", reminderAt: tomorrow, status: "inbox" }],
      recurring: [],
      habits: [],
      debts: [],
    });
    expect(planned).toContainEqual(
      expect.objectContaining({ id: "tt-task-t1", at: tomorrow, title: "Call the bank" }),
    );
  });

  test("coming back to the app reschedules at most every five minutes", () => {
    expect(rescheduleDue(null, now)).toBe(true);
    expect(rescheduleDue(now - 60_000, now)).toBe(false);
    expect(rescheduleDue(now - 5 * 60_000, now)).toBe(true);
  });
});
