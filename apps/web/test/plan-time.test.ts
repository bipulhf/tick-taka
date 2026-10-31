import { describe, expect, test } from "bun:test";
import { startOfLocalDay, zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  historyWeeks,
  scheduleText,
  weekProgressText,
} from "../src/features/habits/habit-progress";
import {
  calendarCells,
  occurrencesByDate,
  weekdayHeaders,
} from "../src/features/plan/calendar-marks";
import { doneByDay, groupByDay, timesheetText } from "../src/features/plan/day-groups";
import { dayMove, minuteOf, timeMove, UNSCHEDULE } from "../src/features/plan/move-task";
import { previousFields } from "../src/features/plan/move-undo";
import {
  layoutBlocks,
  minuteFromOffset,
  PX_PER_MIN,
  START_HOUR,
} from "../src/features/plan/timeline-layout";
import { moveStep, stepsBody } from "../src/features/routines/routine-steps";
import { entriesByDay, minutesByArea } from "../src/features/time/time-totals";

const TZ = "Asia/Dhaka";
const at = (date: string, hour: number, minute = 0) => {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return zonedTimeToUtc({ year, month, day, hour, minute }, TZ);
};

describe("moving tasks", () => {
  test("a move to another day keeps the time and shifts the reminder", () => {
    const task = {
      doAt: at("2026-10-30", 17),
      hasTime: true,
      status: "open" as const,
      reminderAt: at("2026-10-30", 16, 45),
    };
    const move = dayMove(task, "2026-11-02", TZ);
    expect(move.doAt).toBe(at("2026-11-02", 17));
    expect(move.reminderAt).toBe(at("2026-11-02", 16, 45));
    expect(move.status).toBe("open");
  });

  test("an inbox task given a day becomes planned, at the start of that day", () => {
    const move = dayMove(
      { doAt: null, hasTime: false, status: "inbox", reminderAt: null },
      "2026-11-01",
      TZ,
    );
    expect(move).toEqual({
      doAt: startOfLocalDay("2026-11-01", TZ),
      status: "open",
      reminderAt: null,
    });
  });

  test("placing on a time sets the reminder then; a done task stays done", () => {
    const move = timeMove(
      { doAt: null, hasTime: false, status: "done", reminderAt: null },
      "2026-10-30",
      9 * 60 + 30,
      TZ,
    );
    expect(move).toEqual({
      doAt: at("2026-10-30", 9, 30),
      hasTime: true,
      reminderAt: at("2026-10-30", 9, 30),
      status: "done",
    });
    expect(UNSCHEDULE.status).toBe("inbox");
  });

  test("Undo puts back exactly the fields a move changed", () => {
    const task = { id: "t", doAt: 5, hasTime: false, status: "inbox", title: "x" };
    expect(previousFields(task, { doAt: 9, status: "open", reminderAt: 1 })).toEqual({
      doAt: 5,
      status: "inbox",
    });
  });

  test("typed times become minutes of the day", () => {
    expect(minuteOf("09:30")).toBe(570);
    expect(minuteOf("24:00")).toBeNull();
    expect(minuteOf("nine")).toBeNull();
  });
});

describe("day timeline", () => {
  test("a drop snaps to 15 minutes inside the grid", () => {
    expect(minuteFromOffset(0)).toBe(START_HOUR * 60);
    expect(minuteFromOffset(60 * PX_PER_MIN * 3 + 8 * PX_PER_MIN)).toBe(9 * 60 + 15);
    expect(minuteFromOffset(-200)).toBe(START_HOUR * 60);
    expect(minuteFromOffset(100_000)).toBe(23 * 60 - 15);
  });

  test("overlapping blocks share the width; separate ones keep it all", () => {
    const placed = layoutBlocks([
      { id: "a", start: 600, minutes: 120 },
      { id: "b", start: 690, minutes: 30 },
      { id: "c", start: 900, minutes: 60 },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect([byId.a?.lane, byId.a?.lanes]).toEqual([0, 2]);
    expect([byId.b?.lane, byId.b?.lanes]).toEqual([1, 2]);
    expect([byId.c?.lane, byId.c?.lanes]).toEqual([0, 1]);
  });
});

describe("calendar", () => {
  test("whole weeks from the user's first weekday cover the month", () => {
    const cells = calendarCells("month", "2026-10", "2026-10-30", 6);
    expect(cells[0]).toBe("2026-09-26");
    expect(cells.length % 7).toBe(0);
    expect(cells).toContain("2026-10-31");
    expect(
      weekdayHeaders(6)
        .map((d) => d.letter)
        .join(""),
    ).toBe("SSMTWTF");
    expect(calendarCells("week", "2026-10", "2026-10-30", 0)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  test("a monthly bill marks each due day shown", () => {
    const bills = occurrencesByDate(
      [{ id: "rent", dueDate: "2026-10-05", rrule: "FREQ=MONTHLY" }],
      "2026-10",
    );
    expect([...bills.keys()]).toEqual(["2026-10-05", "2026-11-05"]);
  });
});

describe("lists", () => {
  test("upcoming groups by local day in order", () => {
    const tasks = [
      { doAt: at("2026-11-02", 9) },
      { doAt: at("2026-10-31", 23, 30) },
      { doAt: null },
    ];
    const days = groupByDay(tasks as never, TZ);
    expect(days.map(([day]) => day)).toEqual(["2026-10-31", "2026-11-02"]);
  });

  test("the logbook groups by day finished and shares a timesheet", () => {
    const days = doneByDay(
      [
        { title: "Slides", doneAt: at("2026-10-26", 10) },
        { title: "Invoice", doneAt: at("2026-10-27", 9) },
        { title: "Lost", doneAt: null },
      ],
      TZ,
    );
    expect(days.map(([day]) => day)).toEqual(["2026-10-27", "2026-10-26"]);
    expect(timesheetText(days, "2026-10-24", "Job 1")).toBe(
      "What I did for Job 1, week of Sat 24 Oct\n\nMonday, 26 Oct\n  • Slides\n\nTuesday, 27 Oct\n  • Invoice",
    );
  });
});

describe("habits, routines and time", () => {
  test("habit copy counts what was done", () => {
    expect(scheduleText("n_per_week", 3, 1)).toBe("3 times a week");
    expect(scheduleText("daily", null, 8)).toBe("Every day · 8 a day");
    expect(weekProgressText(0, 7, true)).toBe("A fresh week");
    expect(weekProgressText(2, 3, false)).toBe("2 of 3 this week");
  });

  test("history is whole weeks ending this week, with no future days", () => {
    const weeks = historyWeeks([{ date: "2026-10-29", count: 2 }], "2026-10-30", 2, 6);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]?.date).toBe("2026-10-17");
    expect(weeks[1]?.[5]).toEqual({ date: "2026-10-29", count: 2 });
    expect(weeks[1]?.[6]).toEqual({ date: "2026-10-30", count: 0 });
    expect(historyWeeks([], "2026-10-28", 1, 6)[0]?.slice(5)).toEqual([null, null]);
  });

  test("routine steps move within the list and only named ones save", () => {
    expect(moveStep(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveStep(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    const body = stepsBody(
      [
        { id: "s1", title: " Water ", minutes: 2 },
        { title: "  ", minutes: null },
        { title: "Stretch", minutes: null },
      ],
      () => "new",
    );
    expect(body).toEqual([
      { id: "s1", title: "Water", minutes: 2, sort: 0 },
      { id: "new", title: "Stretch", minutes: null, sort: 1 },
    ]);
  });

  test("time sums by area and lists days newest first", () => {
    const entries = [
      { id: "1", areaId: "work", startedAt: at("2026-10-29", 9), endedAt: at("2026-10-29", 10) },
      { id: "2", areaId: null, startedAt: at("2026-10-30", 9), endedAt: at("2026-10-30", 9, 30) },
      { id: "3", areaId: "work", startedAt: at("2026-10-30", 11), endedAt: at("2026-10-30", 13) },
    ];
    expect(minutesByArea(entries, Date.now())).toEqual([
      ["work", 180],
      [null, 30],
    ]);
    expect(entriesByDay(entries, TZ).map(([day, list]) => [day, list.map((e) => e.id)])).toEqual([
      ["2026-10-30", ["3", "2"]],
      ["2026-10-29", ["1"]],
    ]);
  });
});
