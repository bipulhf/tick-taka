import { toMajor } from "@tick-taka/shared/money";
import { readAmount } from "@/features/money/amount-text";

/**
 * The payday plan's sums: the salary split across budgets and savings jars until
 * nothing is left to assign. Amounts are typed text keyed by category id, or
 * `goal:<id>` for a jar. Pure.
 */

export type Amounts = Record<string, string>;

interface Line {
  categoryId: string;
  hasBudget: boolean;
  limitMinor: number;
}

interface Jar {
  id: string;
  suggestedMonthlyMinor: number | null;
}

/** What each field starts with: this month's limits and each jar's suggested saving. */
export function prefill(current: Amounts, lines: Line[], jars: Jar[]): Amounts {
  const next = { ...current };
  for (const line of lines)
    if (line.hasBudget && next[line.categoryId] === undefined)
      next[line.categoryId] = String(toMajor(line.limitMinor));
  for (const jar of jars)
    if (jar.suggestedMonthlyMinor && next[`goal:${jar.id}`] === undefined)
      next[`goal:${jar.id}`] = String(toMajor(jar.suggestedMonthlyMinor));
  return next;
}

/** A field's amount; empty or unreadable counts as nothing. */
export const minorOf = (text: string | undefined) => readAmount(text || "0") ?? 0;

/** The salary less everything given a job so far (below zero when over-assigned). */
export function leftToAssign(salary: string, amounts: Amounts): number {
  const assigned = Object.values(amounts).reduce((sum, text) => sum + minorOf(text), 0);
  return minorOf(salary) - assigned;
}

/** The month's budgets as the plan sets them: every top-level line given an amount. */
export function budgetLines(
  lines: { categoryId: string; rollover: boolean }[],
  amounts: Amounts,
): { categoryId: string; limitMinor: number; rollover: boolean }[] {
  return lines
    .map((line) => ({
      categoryId: line.categoryId,
      limitMinor: minorOf(amounts[line.categoryId]),
      rollover: line.rollover,
    }))
    .filter((line) => line.limitMinor > 0);
}

/**
 * Money to move into each jar from the default account. A jar kept in that same
 * account, or no default account, moves nothing.
 */
export function jarMoves(
  jars: { id: string; name: string; accountId: string | null }[],
  amounts: Amounts,
  fromAccountId: string | null | undefined,
): { goalId: string; name: string; amountMinor: number; fromAccountId: string }[] {
  if (!fromAccountId) return [];
  return jars
    .map((jar) => ({
      goalId: jar.id,
      name: jar.name,
      amountMinor: minorOf(amounts[`goal:${jar.id}`]),
      fromAccountId,
      accountId: jar.accountId,
    }))
    .filter((move) => move.amountMinor > 0 && move.accountId !== fromAccountId)
    .map(({ accountId: _, ...move }) => move);
}
