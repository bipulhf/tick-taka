import { formatClock } from "@/lib/format";
import type { TodayData } from "@/lib/queries";
import type { WidgetCache } from "./widget-cache";

type Snapshot = Pick<
  WidgetCache,
  "leftTodayMinor" | "spentTodayMinor" | "dailyMinor" | "nextUp" | "topThree" | "habits"
>;

const RECENT_MS = 30 * 60_000;

/**
 * What to do next, in one line: the next timed task, else the first open top-three
 * task, else any open task today. Bills and debts stay in the app.
 */
function nextUp(data: TodayData, now: number, timeZone: string): Snapshot["nextUp"] {
  const open = data.timeline.flatMap((item) =>
    item.kind === "task" && item.task.status !== "done" ? [item] : [],
  );
  const timed = open
    .filter((item) => item.at !== null && item.at >= now - RECENT_MS)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))[0];
  if (timed?.at) return { title: timed.task.title, when: formatClock(timed.at, timeZone) };
  const top = data.topThree.find((task) => task.status !== "done");
  if (top) return { title: top.title, when: "Top three" };
  const any = open[0];
  return any ? { title: any.task.title, when: "Today" } : null;
}

/**
 * Whether the widget offers Tiki: only when the server's AI is set up and the chat
 * is on, as in the app's tab bar. While the status hasn't loaded, the last answer stands.
 */
export function widgetAssistant(
  ai: { configured: boolean; features: { assistant: boolean } } | undefined,
  previous: boolean,
): boolean {
  return ai ? ai.configured && ai.features.assistant : previous;
}

/** Today's numbers for the widget, so it answers "what now?" and "can I afford it?". */
export function widgetSnapshot(data: TodayData, now: number, timeZone: string): Snapshot {
  const money = data.safeToSpend;
  return {
    leftTodayMinor: money.hasBudgets ? money.leftTodayMinor : null,
    spentTodayMinor: money.spentTodayMinor,
    dailyMinor: money.dailyMinor,
    nextUp: nextUp(data, now, timeZone),
    topThree: {
      done: data.topThree.filter((task) => task.status === "done").length,
      total: data.topThree.length,
    },
    habits: {
      done: data.habits.filter((habit) => habit.doneToday).length,
      total: data.habits.length,
    },
  };
}
