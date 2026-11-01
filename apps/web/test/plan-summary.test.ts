import { describe, expect, test } from "bun:test";
import { habitTotals, lastDays } from "../src/features/habits/habit-progress";
import { DEFAULT_TASK_MINUTES, plannedMinutes } from "../src/features/plan/day-groups";
import { SOMEDAY, UNSCHEDULE } from "../src/features/plan/move-task";

describe("plan summaries", () => {
  test("planned time counts open tasks, with a default for no estimate", () => {
    expect(
      plannedMinutes([
        { estimateMin: 45, status: "open" },
        { estimateMin: null, status: "inbox" },
        { estimateMin: 90, status: "done" },
      ]),
    ).toBe(45 + DEFAULT_TASK_MINUTES);
    expect(plannedMinutes([])).toBe(0);
  });

  test("parking a task clears its day like unscheduling, but as someday", () => {
    expect({ ...SOMEDAY, status: UNSCHEDULE.status }).toEqual(UNSCHEDULE);
    expect(SOMEDAY.status).toBe("someday");
  });
});

describe("habit summaries", () => {
  test("the last days run oldest first and end today, unlogged days at zero", () => {
    expect(lastDays([{ date: "2026-10-30", count: 2 }], "2026-11-01", 3)).toEqual([
      { date: "2026-10-30", count: 2 },
      { date: "2026-10-31", count: 0 },
      { date: "2026-11-01", count: 0 },
    ]);
  });

  test("totals count each habit up to its own week target", () => {
    const habit = {
      schedule: "daily" as const,
      perWeek: null,
      doneToday: true,
      weekDoneDays: 2,
      streak: { current: 4, unit: "day" },
    };
    const totals = habitTotals([
      { ...habit, name: "Walk" },
      {
        ...habit,
        name: "Gym",
        schedule: "n_per_week",
        perWeek: 2,
        doneToday: false,
        weekDoneDays: 3,
        streak: { current: 9, unit: "week" },
      },
    ]);
    expect(totals).toMatchObject({ doneToday: 1, total: 2, weekDone: 4, weekTarget: 9 });
    expect(totals.best?.name).toBe("Gym");
    expect(habitTotals([]).best).toBeNull();
  });
});
