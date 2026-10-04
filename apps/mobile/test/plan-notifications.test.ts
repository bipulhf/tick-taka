import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { planNotifications } from "../src/features/notifications/plan-notifications";

const TZ = "Asia/Dhaka";
const at = (day: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month: 10, day, hour, minute }, TZ);
const base = {
  now: at(4, 10),
  timeZone: TZ,
  quietHours: { start: "23:00", end: "07:00" },
  tasks: [],
  recurring: [],
  habits: [],
  debts: [],
};

describe("planNotifications", () => {
  test("bills: two days before and 9 am on the day", () => {
    const planned = planNotifications({
      ...base,
      recurring: [
        {
          id: "b1",
          kind: "bill",
          name: "Internet",
          amountMinor: 120_000,
          currency: "BDT",
          dueDate: "2026-10-07",
          remindDays: 2,
        },
      ],
    });
    expect(planned.map((p) => [p.id, p.at])).toEqual([
      ["tt-bill-early-b1", at(5, 9)],
      ["tt-bill-day-b1", at(7, 9)],
    ]);
    expect(planned[1]!.body).toBe("৳1,200");
  });

  test("task reminders inside quiet hours wait for the morning; done and past are skipped", () => {
    const planned = planNotifications({
      ...base,
      tasks: [
        { id: "t1", title: "Late call", reminderAt: at(4, 23, 30), status: "open" },
        { id: "t2", title: "Done", reminderAt: at(4, 15), status: "done" },
        { id: "t3", title: "Past", reminderAt: at(4, 8), status: "open" },
      ],
    });
    expect(planned).toEqual([expect.objectContaining({ id: "tt-task-t1", at: at(5, 7) })]);
  });

  test("habit nudges skip today when already checked", () => {
    const planned = planNotifications({
      ...base,
      habits: [{ id: "h", name: "Water", emoji: "💧", remindAt: "18:00", doneToday: true }],
    });
    expect(planned.map((p) => p.id)).toEqual(["tt-habit-h-1"]);
  });
});
