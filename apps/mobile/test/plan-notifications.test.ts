import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  capNotifications,
  HABIT_DAYS,
  MAX_SCHEDULED,
  planNotifications,
  staleReminderIds,
} from "../src/features/notifications/plan-notifications";

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

  test("Hide amounts keeps the figure out of bill and income reminders", () => {
    const planned = planNotifications({
      ...base,
      hidden: true,
      recurring: [
        {
          id: "i1",
          kind: "income",
          name: "Salary",
          amountMinor: 8_000_000,
          currency: "BDT",
          dueDate: "2026-10-07",
          remindDays: 2,
        },
      ],
    });
    expect(planned.map((p) => [p.title, p.body])).toEqual([
      ["Salary expected in 2 days", "৳•••"],
      ["Salary expected today", "৳•••"],
    ]);
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
    expect(planned.map((p) => p.id)).toEqual(
      Array.from({ length: HABIT_DAYS - 1 }, (_, i) => `tt-habit-h-${i + 1}`),
    );
  });
});

describe("30 days ahead, within the cap", () => {
  const bill = (id: string, dueDate: string) => ({
    id,
    kind: "bill",
    name: id,
    amountMinor: 50_000,
    currency: "BDT",
    dueDate,
    remindDays: 0,
  });

  test("a bill 25 days out is planned; one past 30 days waits for a later refresh", () => {
    const planned = planNotifications({
      ...base,
      recurring: [bill("rent", "2026-10-29"), bill("far", "2026-11-05")],
    });
    expect(planned.map((p) => p.id)).toEqual(["tt-bill-day-rent"]);
  });

  test("no more than the cap, keeping the nearest", () => {
    const tasks = Array.from({ length: 80 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      reminderAt: at(5, 9) + i * 3_600_000,
      status: "open",
    }));
    const planned = planNotifications({ ...base, tasks });
    expect(planned).toHaveLength(MAX_SCHEDULED);
    expect(planned[0]!.id).toBe("tt-task-t0");
    expect(planned.at(-1)!.id).toBe(`tt-task-t${MAX_SCHEDULED - 1}`);
  });

  test("later habit days only fill the room one-off reminders leave", () => {
    const habits = Array.from({ length: 4 }, (_, i) => ({
      id: `h${i}`,
      name: `Habit ${i}`,
      emoji: "💧",
      remindAt: "18:00",
      doneToday: false,
    }));
    // A bill three weeks out still makes it past a week of four habits.
    const planned = planNotifications(
      { ...base, habits, recurring: [bill("rent", "2026-10-25")] },
      10,
    );
    expect(planned).toHaveLength(10);
    expect(planned.map((p) => p.id)).toContain("tt-bill-day-rent");
    // Today and tomorrow for every habit (8), then the nearest later day (one).
    expect(planned.filter((p) => /-[01]$/.test(p.id))).toHaveLength(8);
    expect(planned.filter((p) => p.id.endsWith("-2"))).toHaveLength(1);
    expect(planned.map((p) => p.at)).toEqual([...planned.map((p) => p.at)].sort((a, b) => a - b));
  });

  test("capNotifications keeps time order and drops the filler flag", () => {
    const n = (id: string, at: number, filler?: boolean) => ({
      id,
      at,
      title: id,
      body: "",
      url: "/",
      ...(filler && { filler }),
    });
    expect(capNotifications([n("c", 3), n("a", 1, true), n("b", 2)], 2)).toEqual([
      n("b", 2),
      n("c", 3),
    ]);
    expect(capNotifications([n("a", 1)], 0)).toEqual([]);
  });
});

describe("staleReminderIds", () => {
  test("cancels only our reminders the new plan dropped", () => {
    expect(
      staleReminderIds(
        ["tt-task-a", "tt-task-b", "tt-shutdown", "focus-period-end", "random"],
        ["tt-task-a", "tt-shutdown", "tt-task-c"],
        "tt-",
      ),
    ).toEqual(["tt-task-b"]);
  });
});
