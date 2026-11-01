import { toMajor } from "@tick-taka/shared/money";
import { habitTap } from "@/features/habits/habit-tap";
import type { QuickEntry, WidgetCache, WidgetUndo } from "./widget-cache";

/**
 * How a widget tap changes the cache straight away, before (or without) the server:
 * the widgets redraw from it at once, offline too. Pure, so each is tested.
 */

/** How long a widget shows Undo after a tap. */
export const UNDO_WINDOW_MS = 10_000;

/** True while the widget's last tap can still be undone from the widget. */
export function canUndo(undo: WidgetUndo | null, now: number): undo is WidgetUndo {
  return undo !== null && now - undo.at < UNDO_WINDOW_MS;
}

/** The cache fields a change touched, as they were before it: what Undo puts back. */
export function restoreOf(before: WidgetCache, after: WidgetCache): Partial<WidgetCache> {
  const restore: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof WidgetCache)[]) {
    if (key === "undo" || key === "status" || key === "updatedAt") continue;
    if (before[key] !== after[key]) restore[key] = before[key];
  }
  return restore as Partial<WidgetCache>;
}

/** The cache after Undo: the fields put back and the strip gone. */
export function afterUndo(cache: WidgetCache): WidgetCache {
  if (!cache.undo) return cache;
  return { ...cache, ...cache.undo.restore, undo: null, status: null };
}

/** A task ticked: shown done wherever it is listed. */
export function withTaskDone(cache: WidgetCache, id: string): WidgetCache {
  const tick = (list: WidgetCache["tasks"]) =>
    list.some((task) => task.id === id)
      ? list.map((task) => (task.id === id ? { ...task, done: true, status: "done" } : task))
      : list;
  return { ...cache, tasks: tick(cache.tasks), earlier: tick(cache.earlier) };
}

/** A task moved to tomorrow ("Later"): off today's lists, one more for tomorrow. */
export function withTaskLater(cache: WidgetCache, id: string): WidgetCache {
  const listed = [...cache.tasks, ...cache.earlier].some((task) => task.id === id);
  if (!listed) return cache;
  return {
    ...cache,
    tasks: cache.tasks.filter((task) => task.id !== id),
    earlier: cache.earlier.filter((task) => task.id !== id),
    tomorrowCount: cache.tomorrowCount + 1,
  };
}

/** Where "Later" moves a task: the same time a day on, or a day from now with no date. */
export function laterDoAt(doAt: number | null, now: number): number {
  return (doAt ?? now) + 86_400_000;
}

/**
 * A habit ring tapped: one more for today. At the target it changes nothing (a stray
 * tap must never wipe a full day), as in the app (habit-tap.ts).
 */
export function withHabitLogged(cache: WidgetCache, id: string): WidgetCache {
  const habit = cache.habits.find((h) => h.id === id);
  if (!habit) return cache;
  const tap = habitTap(habit.count, habit.target);
  if (tap.kind === "atTarget") return cache;
  return {
    ...cache,
    habits: cache.habits.map((h) => (h.id === id ? { ...h, count: tap.next } : h)),
  };
}

/** A bill paid (or income received): off the list, and out of "still to pay". */
export function withBillPaid(cache: WidgetCache, id: string): WidgetCache {
  const bill = cache.bills.find((b) => b.id === id);
  if (!bill) return cache;
  return {
    ...cache,
    bills: cache.bills.filter((b) => b.id !== id),
    billsLeftMinor:
      bill.thisMonth && bill.currency === cache.currency
        ? Math.max(0, cache.billsLeftMinor - bill.amountMinor)
        : cache.billsLeftMinor,
  };
}

/** A quick-log: today's and this month's spending move by its amount. */
export function withQuickLog(cache: WidgetCache, entry: QuickEntry): WidgetCache {
  return {
    ...cache,
    leftTodayMinor: cache.leftTodayMinor === null ? null : cache.leftTodayMinor - entry.amountMinor,
    spentTodayMinor: cache.spentTodayMinor + entry.amountMinor,
    month: cache.month
      ? { ...cache.month, outMinor: cache.month.outMinor + entry.amountMinor }
      : null,
  };
}

/**
 * Where a quick-log chip goes when there is no account to log to (the last one was
 * deleted): the app's quick-add with the entry typed in, instead of a write that
 * can't succeed. Null while the widget can log in place.
 */
export function quickLogLink(entry: QuickEntry, accountId: string | null): string | null {
  if (accountId) return null;
  const text = `${entry.note} ${toMajor(entry.amountMinor)}`;
  return `ticktaka://add?kind=expense&text=${encodeURIComponent(text)}`;
}

/** The Undo strip's words: what happened, and whether it waits for a connection. */
export function undoText(undo: Pick<WidgetUndo, "text" | "queued">): string {
  return undo.queued ? `${undo.text}, syncs later` : undo.text;
}
