import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import {
  nextDaily,
  nextWeekly,
  showBrowserNotification,
  useBrowserNotifications,
} from "./browser-notifications";

/** setTimeout can't wait longer than about 24.8 days; check again well before that. */
const MAX_WAIT_MS = 6 * 3_600_000;

function useRing(
  enabled: boolean,
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
          if (wait <= MAX_WAIT_MS) ring();
          schedule();
        },
        Math.min(Math.max(wait, 1000), MAX_WAIT_MS),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, ...deps]);
}

/**
 * The daily shutdown and the weekly review, as browser notifications while a tab is
 * open (the phone schedules the same two). Mount once, inside the signed-in shell.
 */
export function BrowserReminders() {
  const navigate = useNavigate();
  const prefs = useBrowserNotifications();
  const { data: settings } = useSettings();
  const zone = userTime(settings).timeZone;
  const shutdown = settings?.shutdownTime;
  const reviewDay = settings?.weeklyReviewDay;
  const reviewTime = settings?.weeklyReviewTime;

  useRing(
    prefs.enabled && prefs.kinds.shutdown,
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
