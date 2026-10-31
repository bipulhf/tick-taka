import { expect, test } from "bun:test";
import { briefingInput, suggestionInput, type TodayLike } from "../src/features/assistant/moment";

const task = (id: string, status = "open") => ({ id, status });

const today: TodayLike = {
  date: "2026-10-31",
  topThree: [task("a"), task("b", "done"), task("c")],
  timeline: [
    { kind: "task", task: task("a") },
    { kind: "task", task: task("d") },
    { kind: "task", task: task("e", "done") },
    { kind: "bill", name: "Internet", dueDate: "2026-10-31" },
    { kind: "payday", name: "Salary", dueDate: "2026-10-31" },
    { kind: "debt" },
  ],
  evening: [task("f", "inbox"), task("g", "someday")],
  upcoming: [
    { kind: "bill", name: "Rent", dueDate: "2026-11-01" },
    { kind: "income", name: "Tuition", dueDate: "2026-11-01" },
    { kind: "bill", name: "Gym", dueDate: "2026-11-03" },
    { kind: "bill", name: "Phone", dueDate: "2026-11-09" },
  ],
  habits: [{ doneToday: true }, { doneToday: false }, { doneToday: false }],
  safeToSpend: { hasBudgets: true, leftTodayMinor: 64_000 },
  counts: { overdue: 2, inbox: 5 },
};

test("briefingInput counts open tasks once and lists what's due today and tomorrow", () => {
  expect(briefingInput(today, 9, { currency: "BDT" })).toEqual({
    hour: 9,
    tasksLeft: 4,
    topThreeLeft: 2,
    safeToSpendMinor: 64_000,
    due: [
      { name: "Internet", kind: "bill", day: "today" },
      { name: "Salary", kind: "income", day: "today" },
      { name: "Rent", kind: "bill", day: "tomorrow" },
      { name: "Tuition", kind: "income", day: "tomorrow" },
    ],
    habitsLeft: 2,
    currency: "BDT",
  });
});

test("briefingInput has no money line without budgets", () => {
  const plain = { ...today, safeToSpend: { hasBudgets: false, leftTodayMinor: 0 } };
  expect(briefingInput(plain, 9).safeToSpendMinor).toBeNull();
});

test("suggestionInput counts bills due in the next three days", () => {
  expect(suggestionInput(today, "/money", 20, true)).toEqual({
    view: "/money",
    hour: 20,
    overdue: 2,
    inbox: 5,
    topThreeLeft: 2,
    billsDueSoon: 3,
    hasAccounts: true,
    hasBudgets: true,
  });
});

test("suggestionInput before Today has loaded", () => {
  expect(suggestionInput(undefined, "/", 8, false)).toMatchObject({
    overdue: 0,
    billsDueSoon: 0,
    hasAccounts: false,
    hasBudgets: false,
  });
});
