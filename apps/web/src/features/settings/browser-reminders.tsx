import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import {
  nextDaily,
  nextWeekly,
  notificationPermission,
  showBrowserNotification,
  useBrowserNotifications,
} from "./browser-notifications";
import { claimReminder } from "./reminder-claim";
import { MAX_WAIT_MS } from "./reminder-plan";
import { RANG_KEEP_MS, usePlannedReminders } from "./use-planned-reminders";

/** Rings `key` at each moment `next` gives, in one tab only (the first to claim it). */
function useRing(
  enabled: boolean,
  key: string,
  next: (() => number) | null,
  ring: () => void,
  deps: readonly unknown[],
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps name what the schedule depends on.
  useEffect(() => {
    if (!enabled || !next) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const at = next();
      const wait = at - Date.now();
      timer = setTimeout(
        () => {
          if (wait <= MAX_WAIT_MS)
            void claimReminder(`${key}@${at}`, at + RANG_KEEP_MS).then((mine) => mine && ring());
          schedule();
        },
        Math.min(Math.max(wait, 1000), MAX_WAIT_MS),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, key, ...deps]);
}

/**
 * The phone's reminders as browser notifications while a tab is open: the daily
 * shutdown, the weekly review, and the planned ones (tasks, bills, habits, debts, the
 * pace alert). Mount once, inside the signed-in shell.
 */
export function BrowserReminders() {
  const navigate = useNavigate();
  const prefs = useBrowserNotifications();
  usePlannedReminders(prefs.enabled && notificationPermission() === "granted");
  const { data: settings } = useSettings();
  const zone = userTime(settings).timeZone;
  const shutdown = settings?.shutdownTime;
  const reviewDay = settings?.weeklyReviewDay;
  const reviewTime = settings?.weeklyReviewTime;

  useRing(
    prefs.enabled && prefs.kinds.shutdown,
    "tt-shutdown",
    shutdown ? () => nextDaily(shutdown, Date.now(), zone) : null,
    () =>
      showBrowserNotification(
        "shutdown",
        "Daily shutdown 🌙",
        "Two minutes to close the day.",
        () => void navigate({ to: "/review/shutdown" }),
      ),
    [shutdown, zone],
  );
  useRing(
    prefs.enabled && prefs.kinds.weeklyReview,
    "tt-weekly-review",
    reviewTime !== undefined && reviewDay !== undefined
      ? () => nextWeekly(reviewDay, reviewTime, Date.now(), zone)
      : null,
    () =>
      showBrowserNotification(
        "weeklyReview",
        "Weekly review",
        "Five minutes to look back and pick next week's focus.",
        () => void navigate({ to: "/review/weekly" }),
      ),
    [reviewDay, reviewTime, zone],
  );
  return null;
}
