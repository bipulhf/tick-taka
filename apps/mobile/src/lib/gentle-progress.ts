import { plural } from "./format";

/**
 * "Reward, never guilt" (PRODUCT.md): progress is said by what was done, never
 * by what is missing. A zero streak invites a start; a week counts days done,
 * not days short; time beyond a plan is extra, not a failure. Pure.
 */

/** "Daily goal: 3 days", or an invitation instead of "0 days". */
export function streakText(name: string, current: number): string {
  return current > 0 ? `${name}: ${plural(current, "day")}` : `${name}: start one today`;
}

/** "best 5 days", or nothing until there is a best to speak of. */
export function bestText(best: number, unit = "day"): string | null {
  return best > 0 ? `best ${plural(best, unit)}` : null;
}

/** A habit's streak for the weekly review: "🔥 3 days · best 5 days", or a fresh start at 0. */
export function habitStreakText(current: number, best: number, unit = "day"): string {
  const bestPart = bestText(best, unit);
  const now = current > 0 ? `🔥 ${plural(current, unit)}` : "A fresh start";
  return bestPart ? `${now} · ${bestPart}` : now;
}

/**
 * The weekly review's wins, said by what got done: a line with a zero in it is left
 * out, and a week with none of them gets one kind line instead.
 */
export function winLines(wins: {
  tasksDone: number;
  topThreeDone: number;
  topThreePlanned: number;
  focusMinutes: number;
  focusSessions: number;
  highlights: number;
  formatMinutes: (minutes: number) => string;
}): string[] {
  const lines = [
    wins.tasksDone > 0 ? `✓ ${plural(wins.tasksDone, "task")} finished` : null,
    wins.topThreeDone > 0
      ? `⭐ ${wins.topThreeDone} of ${plural(wins.topThreePlanned, "top-three task")}`
      : null,
    wins.focusSessions > 0
      ? `🌱 ${wins.formatMinutes(wins.focusMinutes)} of focus in ${plural(wins.focusSessions, "session")}`
      : null,
  ].filter((line): line is string => line !== null);
  return lines.length || wins.highlights ? lines : ["A quiet week. Next week is a fresh start."];
}

/** A habit's week by days done: "3 days this week"; "1 of 3 this week" for n-per-week. */
export function weekProgressText(done: number, target: number, daily: boolean): string {
  if (done === 0) return "A fresh week";
  return daily ? `${plural(done, "day")} this week` : `${done} of ${target} this week`;
}

/**
 * Tracked time against a plan. Over plan, the bar shows the planned share in full
 * colour and the rest lighter, with the extra named ("+10h"), instead of looking
 * the same as on plan.
 */
export function planShare(
  trackedMinutes: number,
  plannedMinutes: number,
): { filled: number; extraMinutes: number } {
  if (plannedMinutes <= 0) return { filled: trackedMinutes > 0 ? 1 : 0, extraMinutes: 0 };
  if (trackedMinutes <= plannedMinutes)
    return { filled: trackedMinutes / plannedMinutes, extraMinutes: 0 };
  return { filled: plannedMinutes / trackedMinutes, extraMinutes: trackedMinutes - plannedMinutes };
}
