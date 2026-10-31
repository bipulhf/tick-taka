import { formatAmount, type Numerals } from "./money";
import { greeting } from "./tiki";

/**
 * The few lines at the top of a new chat, from numbers the apps already have on
 * Today. No AI call. Calm and short: a reminder of the day, never a scolding.
 */

export interface BriefingDue {
  name: string;
  /** A bill to pay, or money coming in (a payday). */
  kind: "bill" | "income";
  day: "today" | "tomorrow";
}

export interface BriefingInput {
  /** Local hour 0–23 */
  hour: number;
  /** Open tasks planned for today, top three included. */
  tasksLeft: number;
  /** Today's top three not done yet. */
  topThreeLeft: number;
  /** Safe to spend today in minor units, or null when there are no budgets. */
  safeToSpendMinor: number | null;
  /** Bills and paydays due today or tomorrow. */
  due: BriefingDue[];
  /** Habits not yet checked in today. */
  habitsLeft: number;
  currency?: string;
  numerals?: Numerals;
}

export interface Briefing {
  greeting: string;
  lines: string[];
}

const MAX_LINES = 3;
/** Names listed in one line before "and 2 more". */
const MAX_NAMES = 3;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function names(items: BriefingDue[]): string {
  const shown = items.slice(0, MAX_NAMES).map((item) => item.name.trim() || "one");
  const more = items.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(" and ");
}

function tasksLine(input: BriefingInput): string {
  if (input.tasksLeft <= 0) return "Today's list is clear.";
  const left = `${plural(input.tasksLeft, "task")} left today`;
  if (input.topThreeLeft <= 0) return `${left}.`;
  if (input.topThreeLeft < input.tasksLeft)
    return `${left}, ${input.topThreeLeft} in your top three.`;
  return `${left}, ${input.tasksLeft === 1 ? "" : "all "}in your top three.`;
}

function moneyLine(input: BriefingInput): string | null {
  if (input.safeToSpendMinor === null) return null;
  const options = { currency: input.currency, numerals: input.numerals };
  if (input.safeToSpendMinor >= 0)
    return `${formatAmount(input.safeToSpendMinor, options)} safe to spend today.`;
  return `Spending is ${formatAmount(-input.safeToSpendMinor, options)} past today's plan. Tomorrow is a fresh start.`;
}

function dueLine(due: BriefingDue[]): string | null {
  if (due.length === 0) return null;
  const parts: string[] = [];
  for (const day of ["today", "tomorrow"] as const) {
    const bills = due.filter((item) => item.day === day && item.kind === "bill");
    const income = due.filter((item) => item.day === day && item.kind === "income");
    if (bills.length) parts.push(`${names(bills)} due ${day}`);
    if (income.length) parts.push(`${names(income)} coming in ${day}`);
  }
  const text = parts.join("; ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function habitsLine(habitsLeft: number): string | null {
  return habitsLeft > 0 ? `${plural(habitsLeft, "habit")} to check in.` : null;
}

/** A greeting and at most three lines: tasks, money, what's due, then habits if there's room. */
export function briefingFor(input: BriefingInput): Briefing {
  const lines = [
    tasksLine(input),
    moneyLine(input),
    dueLine(input.due),
    habitsLine(input.habitsLeft),
  ].filter((line): line is string => line !== null);
  return { greeting: greeting(input.hour), lines: lines.slice(0, MAX_LINES) };
}
