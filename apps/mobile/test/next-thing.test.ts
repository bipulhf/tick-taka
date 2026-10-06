import { describe, expect, test } from "bun:test";
import { nextThing } from "../src/features/today/next-thing";

const NOW = 1_000_000_000;
const task = (id: string, status = "open") => ({ id, title: id, status });

describe("Today's 'Next:' line", () => {
  test("the next timed task wins, even one that started a few minutes ago", () => {
    const data = {
      topThree: [task("top")],
      timeline: [
        { kind: "task" as const, at: NOW - 60 * 60_000, task: task("long ago") },
        { kind: "task" as const, at: NOW - 10 * 60_000, task: task("standup") },
        { kind: "bill", at: NOW },
      ],
    };
    expect(nextThing(data, NOW)).toEqual({ id: "standup", title: "standup", at: NOW - 600_000 });
  });

  test("with nothing timed ahead, the first unfinished top-three task", () => {
    const data = {
      topThree: [task("done", "done"), task("thesis")],
      timeline: [{ kind: "task" as const, at: null, task: task("untimed") }],
    };
    expect(nextThing(data, NOW)?.id).toBe("thesis");
  });

  test("then any open task of the day; nothing when all is done", () => {
    expect(
      nextThing(
        { topThree: [], timeline: [{ kind: "task" as const, at: null, task: task("read") }] },
        NOW,
      )?.id,
    ).toBe("read");
    expect(
      nextThing(
        {
          topThree: [task("a", "done")],
          timeline: [{ kind: "task" as const, at: NOW, task: task("b", "done") }],
        },
        NOW,
      ),
    ).toBeNull();
  });
});
