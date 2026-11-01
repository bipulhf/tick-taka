import { describe, expect, test } from "bun:test";
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
