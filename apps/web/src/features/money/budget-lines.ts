import { daysInMonth, monthOf, parseLocalDate } from "@tick-taka/shared/dates";
import { toMajor } from "@tick-taka/shared/money";
import { readAmount } from "./amount-text";

/** Which budget lines show, and what the editor sends. Pure, so it can be tested. */

export type BudgetType = "flexible" | "fixed" | "non_monthly";

export const BUCKETS: { key: BudgetType; title: string; hint: string }[] = [
  { key: "flexible", title: "Flexible", hint: "Food, rides, fun. Drives safe to spend." },
  { key: "fixed", title: "Fixed", hint: "Rent, bills: already planned." },
  { key: "non_monthly", title: "Non-monthly", hint: "Yearly renewals, Eid: a slice each month." },
];

export interface LineLike {
  categoryId: string;
  parentId: string | null;
  budgetType: string;
  hasBudget: boolean;
  limitMinor: number;
  rollover: boolean;
  carriedMinor: number;
  spentMinor: number;
  availableMinor: number;
}

export interface Totals {
  limitMinor: number;
  spentMinor: number;
}

/**
 * A bucket's lines: those with a budget or spending, and sub-categories only when
 * they have a budget of their own (otherwise their spending is in the parent's).
 */
export function bucketLines<L extends LineLike>(lines: L[], bucket: BudgetType): L[] {
  return lines.filter(
    (l) =>
      l.budgetType === bucket &&
      (l.hasBudget || l.spentMinor > 0) &&
      (l.parentId === null || l.hasBudget),
  );
}

/** A group with nothing budgeted or spent is just noise ("৳0 of ৳0"). */
export function bucketShown(totals: Totals, lines: LineLike[]): boolean {
  return !(totals.limitMinor === 0 && totals.spentMinor === 0 && lines.length === 0);
}

/** Nothing budgeted and nothing spent: the empty state. */
export function noBudgets(lines: LineLike[]): boolean {
  return lines.every((l) => !l.hasBudget && l.spentMinor === 0);
}

/** The line's limit with what rolled in from last month. */
export const lineLimit = (line: LineLike) => line.limitMinor + line.carriedMinor;

/** How full the line's bar is: spent over the limit (full when there's no room at all). */
export function lineProgress(line: LineLike): number {
  const limit = lineLimit(line);
  return limit > 0 ? line.spentMinor / limit : 1;
}

/**
 * A bucket's lines, closest to their limit first (over-limit lines lead); lines with
 * spending but no budget go last, biggest spend first.
 */
export function byCloseness<L extends LineLike>(lines: L[]): L[] {
  return [...lines].sort((a, b) => {
    if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1;
    if (!a.hasBudget) return b.spentMinor - a.spentMinor;
    return lineProgress(b) - lineProgress(a);
  });
}

/**
 * Where today falls in `month`, 0 to 1 (as budgetPace counts it: day of the month over
 * its length), for the pace mark on each bar. Undefined for any other month.
 */
export function paceMark(today: string, month: string): number | undefined {
  if (monthOf(today) !== month) return undefined;
  return parseLocalDate(today).day / daysInMonth(month);
}

/** What the API's whole-month PUT keeps for every line that has a budget. */
export function keptLines(lines: LineLike[]) {
  return lines
    .filter((l) => l.hasBudget)
    .map(({ categoryId, limitMinor, rollover }) => ({ categoryId, limitMinor, rollover }));
}

/** The month without one line (the API sets a whole month at once). */
export function withoutLine(lines: LineLike[], categoryId: string) {
  return keptLines(lines).filter((l) => l.categoryId !== categoryId);
}

export interface EditorLine {
  limit: string;
  rollover: boolean;
}

/** The editor's starting text per category: a suggestion wins over the saved limit. */
export function editorLines(
  lines: LineLike[],
  suggested?: Record<string, number>,
): Record<string, EditorLine> {
  const next: Record<string, EditorLine> = {};
  for (const line of lines) {
    const limit = suggested?.[line.categoryId] ?? (line.hasBudget ? line.limitMinor : 0);
    next[line.categoryId] = { limit: limit ? String(toMajor(limit)) : "", rollover: line.rollover };
  }
  return next;
}

/** The PUT /budgets body's lines: every category with a limit above zero. */
export function editorPayload(lines: Record<string, EditorLine>) {
  return Object.entries(lines)
    .map(([categoryId, line]) => ({
      categoryId,
      limitMinor: Math.max(0, readAmount(line.limit || "0") ?? 0),
      rollover: line.rollover,
    }))
    .filter((line) => line.limitMinor > 0);
}

export function editorTotal(lines: Record<string, EditorLine>): number {
  return editorPayload(lines).reduce((sum, l) => sum + l.limitMinor, 0);
}

/** Reads the panel's `suggested` preset (a JSON object of categoryId → limitMinor). */
export function parseSuggested(text: string | null): Record<string, number> | undefined {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const entries = Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 0,
    );
    return Object.fromEntries(entries);
  } catch {
    return undefined;
  }
}
