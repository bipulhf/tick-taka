import { expect, test } from "bun:test";
import {
  briefingInput,
  type DayLike,
  suggestionInput,
} from "../src/features/assistant/chat-intro-inputs";

const task = (id: string, status = "open") => ({ id, status });
const habit = (fields: Partial<DayLike["habits"][number]> = {}) => ({
  doneToday: false,
  schedule: "daily",
  perWeek: null,
  weekDoneDays: 0,
  ...fields,
});

const day = (fields: Partial<DayLike> = {}): DayLike => ({
  date: "2026-10-31",
  tomorrow: "2026-11-01",
  topThree: [],
  evening: [],
  timeline: [],
  upcoming: [],
  habits: [],
  safeToSpend: { hasBudgets: true, leftTodayMinor: 64_000 },
  counts: { overdue: 0, inbox: 0 },
  ...fields,
});

test("tasks left count each open task once, top three included", () => {
  const input = briefingInput(
    day({
      topThree: [task("a"), task("b", "done")],
      timeline: [
        { kind: "task", task: task("a") },
        { kind: "task", task: task("c") },
      ],
      evening: [task("d"), task("e", "someday")],
    }),
    9,
  );
  expect(input.tasksLeft).toBe(3);
  expect(input.topThreeLeft).toBe(1);
});

test("money is null without budgets", () => {
  expect(briefingInput(day(), 9).safeToSpendMinor).toBe(64_000);
  expect(
    briefingInput(day({ safeToSpend: { hasBudgets: false, leftTodayMinor: 0 } }), 9)
      .safeToSpendMinor,
  ).toBeNull();
});

test("due names bills and paydays for today and tomorrow, not late ones", () => {
  const input = briefingInput(
    day({
      timeline: [
        { kind: "bill", name: "Rent", dueDate: "2026-10-31" },
        { kind: "bill", name: "Internet", dueDate: "2026-10-29" },
        { kind: "payday", name: "Salary", dueDate: "2026-10-31" },
      ],
      upcoming: [
        { kind: "bill", name: "Gas", dueDate: "2026-11-01", status: "due_soon" },
        { kind: "bill", name: "Water", dueDate: "2026-11-04", status: "due_soon" },
      ],
    }),
    9,
  );
  expect(input.due).toEqual([
    { name: "Rent", kind: "bill", day: "today" },
    { name: "Salary", kind: "income", day: "today" },
    { name: "Gas", kind: "bill", day: "tomorrow" },
  ]);
});

test("habits left skip ones done today or done for the week", () => {
  const input = briefingInput(
    day({
      habits: [
        habit(),
        habit({ doneToday: true }),
        habit({ schedule: "weekly", weekDoneDays: 1 }),
        habit({ schedule: "n_per_week", perWeek: 3, weekDoneDays: 2 }),
      ],
    }),
    9,
  );
  expect(input.habitsLeft).toBe(2);
});

test("suggestions read the counts, and stay calm without Today data", () => {
  const input = suggestionInput(
    day({
      counts: { overdue: 2, inbox: 4 },
      timeline: [{ kind: "bill", name: "Rent", dueDate: "2026-10-30" }],
      upcoming: [
        { kind: "bill", name: "Gas", dueDate: "2026-11-01", status: "due_soon" },
        { kind: "income", name: "Salary", dueDate: "2026-11-01", status: "due_soon" },
        { kind: "bill", name: "Water", dueDate: "2026-11-20", status: "upcoming" },
      ],
    }),
    "/money",
    20,
    true,
  );
  expect(input).toMatchObject({ view: "/money", hour: 20, overdue: 2, inbox: 4, billsDueSoon: 2 });
  expect(suggestionInput(undefined, "/", 9, true)).toMatchObject({
    overdue: 0,
    billsDueSoon: 0,
    hasBudgets: false,
  });
});
