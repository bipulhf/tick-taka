import { describe, expect, test } from "bun:test";
import { briefingFor } from "../src/tiki-briefing";

const base = {
  hour: 9,
  tasksLeft: 0,
  topThreeLeft: 0,
  safeToSpendMinor: null,
  due: [],
  habitsLeft: 0,
};

describe("briefingFor", () => {
  test("greets by the hour, and a quiet day is one calm line", () => {
    expect(briefingFor(base)).toEqual({
      greeting: "Good morning",
      lines: ["Today's list is clear."],
    });
    expect(briefingFor({ ...base, hour: 19 }).greeting).toBe("Good evening");
  });

  test("tasks and the top three", () => {
    const line = (tasksLeft: number, topThreeLeft: number) =>
      briefingFor({ ...base, tasksLeft, topThreeLeft }).lines[0];
    expect(line(5, 2)).toBe("5 tasks left today, 2 in your top three.");
    expect(line(3, 3)).toBe("3 tasks left today, all in your top three.");
    expect(line(1, 1)).toBe("1 task left today, in your top three.");
    expect(line(4, 0)).toBe("4 tasks left today.");
  });

  test("safe to spend in taka, and an overspent day without guilt", () => {
    expect(briefingFor({ ...base, safeToSpendMinor: 120_000 }).lines[1]).toBe(
      "৳1,200 safe to spend today.",
    );
    expect(briefingFor({ ...base, safeToSpendMinor: -30_050 }).lines[1]).toBe(
      "Spending is ৳300.50 past today's plan. Tomorrow is a fresh start.",
    );
    expect(briefingFor({ ...base, safeToSpendMinor: 120_000, numerals: "beng" }).lines[1]).toBe(
      "৳১,২০০ safe to spend today.",
    );
  });

  test("bills and paydays by name", () => {
    const { lines } = briefingFor({
      ...base,
      due: [
        { name: "Internet", kind: "bill", day: "today" },
        { name: "Rent", kind: "bill", day: "tomorrow" },
        { name: "Salary", kind: "income", day: "tomorrow" },
      ],
    });
    expect(lines[1]).toBe("Internet due today; Rent due tomorrow; Salary coming in tomorrow.");
    const many = briefingFor({
      ...base,
      due: ["A", "B", "C", "D", "E"].map((name) => ({
        name,
        kind: "bill" as const,
        day: "today" as const,
      })),
    });
    expect(many.lines[1]).toBe("A, B, C and 2 more due today.");
  });

  test("never more than three lines; habits only when there is room", () => {
    const full = briefingFor({
      ...base,
      tasksLeft: 2,
      safeToSpendMinor: 50_000,
      due: [{ name: "Rent", kind: "bill", day: "today" }],
      habitsLeft: 2,
    });
    expect(full.lines).toHaveLength(3);
    expect(full.lines.join(" ")).not.toContain("habit");
    expect(briefingFor({ ...base, habitsLeft: 1 }).lines).toEqual([
      "Today's list is clear.",
      "1 habit to check in.",
    ]);
  });
});
