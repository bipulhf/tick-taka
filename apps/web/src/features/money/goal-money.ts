import { diffDays } from "@tick-taka/shared/dates";

/** Pure rules behind the goals view and panel. */

/**
 * The account a jar contribution comes from: the one picked, unless it is the jar's
 * own account (money never moves from a jar into itself), else the first other one.
 */
export function contributionSource(
  jarAccountId: string | null | undefined,
  chosen: string | null | undefined,
  accounts: { id: string }[],
): string | undefined {
  if (chosen && chosen !== jarAccountId) return chosen;
  return accounts.find((a) => a.id !== jarAccountId)?.id;
}

/** A deadline is a day still ahead: today or earlier is refused. */
export function isFutureDeadline(date: string, today: string): boolean {
  return date > today;
}

export type GoalPace = "done" | "on_track" | "behind";

/**
 * Where a goal stands: done once reached (or marked done); with a deadline, on track
 * while what's saved keeps up with a straight line from the day it started to the
 * deadline, else behind. Null without a deadline: there's no pace to keep.
 */
export function goalPace(
  goal: {
    savedMinor: number;
    targetMinor: number;
    reached: boolean;
    doneAt: number | null;
    deadline: string | null;
  },
  startedOn: string,
  today: string,
): GoalPace | null {
  if (goal.reached || goal.doneAt !== null) return "done";
  if (!goal.deadline) return null;
  if (today >= goal.deadline) return "behind";
  const total = diffDays(startedOn, goal.deadline);
  if (total <= 0) return "on_track";
  const elapsed = Math.max(0, diffDays(startedOn, today));
  return goal.savedMinor >= (goal.targetMinor * elapsed) / total ? "on_track" : "behind";
}

/** The strip's totals: saved and target across every goal, and the monthly pace of the open ones. */
export function goalTotals(
  goals: {
    savedMinor: number;
    targetMinor: number;
    suggestedMonthlyMinor: number | null;
    reached: boolean;
    doneAt: number | null;
  }[],
) {
  return goals.reduce(
    (sum, goal) => ({
      savedMinor: sum.savedMinor + Math.max(0, goal.savedMinor),
      targetMinor: sum.targetMinor + goal.targetMinor,
      monthlyMinor:
        sum.monthlyMinor +
        (goal.reached || goal.doneAt !== null ? 0 : (goal.suggestedMonthlyMinor ?? 0)),
    }),
    { savedMinor: 0, targetMinor: 0, monthlyMinor: 0 },
  );
}
