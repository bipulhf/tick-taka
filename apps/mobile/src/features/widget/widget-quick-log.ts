import type { QuickEntry, WidgetCache } from "./widget-cache";

/** How long the widget offers "Undo" after a quick-log. */
export const UNDO_WINDOW_MS = 10 * 60_000;

/** True while the widget's last quick-log can still be undone from the widget. */
export function canUndo(cache: WidgetCache, now: number): boolean {
  return cache.lastLog !== null && now - cache.lastLog.at < UNDO_WINDOW_MS;
}

/** The cache after a quick-log: today's numbers move and the log becomes undoable. */
export function afterLog(
  cache: WidgetCache,
  entry: QuickEntry,
  log: { id: string; queued: boolean },
  now: number,
): WidgetCache {
  return {
    ...cache,
    leftTodayMinor: cache.leftTodayMinor === null ? null : cache.leftTodayMinor - entry.amountMinor,
    spentTodayMinor: cache.spentTodayMinor + entry.amountMinor,
    status: null,
    lastLog: {
      id: log.id,
      label: entry.label,
      amountMinor: entry.amountMinor,
      at: now,
      queued: log.queued,
    },
  };
}

/** The cache after Undo: today's numbers go back and the status says what was removed. */
export function afterUndo(cache: WidgetCache): WidgetCache {
  const log = cache.lastLog;
  if (!log) return cache;
  return {
    ...cache,
    leftTodayMinor: cache.leftTodayMinor === null ? null : cache.leftTodayMinor + log.amountMinor,
    spentTodayMinor: Math.max(0, cache.spentTodayMinor - log.amountMinor),
    status: `Removed ${log.label}`,
    lastLog: null,
  };
}

/** Line shown beside the Undo button. */
export function lastLogText(log: NonNullable<WidgetCache["lastLog"]>, amount: string): string {
  return log.queued ? `Saved ${log.label} ${amount}, syncs later` : `Logged ${log.label} ${amount}`;
}
