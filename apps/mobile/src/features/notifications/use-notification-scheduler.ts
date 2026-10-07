import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api, unwrap } from "@/lib/api";
import { ensureNotificationPermission, reminderSyncError } from "@/lib/notifications";
import { useSettings } from "@/lib/queries";
import { useToday } from "@/lib/use-today";
import { planNotifications } from "./plan-notifications";
import { reminderQuery, rescheduleDue } from "./reminder-window";

const PREFIX = "tt-";
const PACE_KEY = "tt.pace-alerts";

async function reschedule(settings: NonNullable<ReturnType<typeof useSettings>["data"]>) {
  if (!(await ensureNotificationPermission())) return;
  const now = Date.now();
  const [tasks, recurring, habits, debts] = await Promise.all([
    // By when the reminder rings, not the day the task is planned for.
    unwrap(api.tasks.$get({ query: reminderQuery(now) })),
    unwrap(api.recurring.$get()),
    unwrap(api.habits.$get({ query: {} })),
    unwrap(api.debts.$get()),
  ]);
  const planned = planNotifications({
    now,
    timeZone: settings.timeZone,
    quietHours: settings.quietHours,
    tasks,
    recurring,
    habits,
    debts,
  });
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const n of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.at) },
    });
  }
  const [shutdownHour, shutdownMinute] = settings.shutdownTime.split(":").map(Number) as [
    number,
    number,
  ];
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}shutdown`,
    content: {
      title: "Daily shutdown 🌙",
      body: "Two minutes to close the day.",
      data: { url: "/review/shutdown" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: shutdownHour,
      minute: shutdownMinute,
    },
  });
  const [reviewHour, reviewMinute] = settings.weeklyReviewTime.split(":").map(Number) as [
    number,
    number,
  ];
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}weekly-review`,
    content: {
      title: "Weekly review",
      body: "Five minutes to look back and pick next week's focus.",
      data: { url: "/review/weekly" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: settings.weeklyReviewDay + 1,
      hour: reviewHour,
      minute: reviewMinute,
    },
  });
}

/** Runs a reschedule; a failure is logged and shown quietly in Settings, never swallowed. */
async function rescheduleSafely(settings: Parameters<typeof reschedule>[0]): Promise<void> {
  try {
    await reschedule(settings);
    reminderSyncError.set(null);
  } catch (error) {
    console.warn("notifications: reschedule failed", error);
    reminderSyncError.set(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Re-schedules local notifications on start, whenever fresh data arrives and when
 * the app comes back to the front; no push service needed.
 */
export function useNotificationScheduler() {
  const { data: settings } = useSettings();
  const today = useToday();
  const lastRun = useRef<number | null>(null);
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on start and again each time Today's data refreshes (dataUpdatedAt), not only when settings change.
  useEffect(() => {
    if (!settings) return;
    const timer = setTimeout(() => {
      lastRun.current = Date.now();
      void rescheduleSafely(settings);
    }, 1500);
    return () => clearTimeout(timer);
  }, [settings, today.dataUpdatedAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      const current = latest.current;
      if (status !== "active" || !current || !rescheduleDue(lastRun.current, Date.now())) return;
      lastRun.current = Date.now();
      void rescheduleSafely(current);
    });
    return () => subscription.remove();
  }, []);

  // Pace alert: one calm heads-up per category per month, never a stream.
  const pace = today.data?.paceAlert;
  useEffect(() => {
    if (!pace || !today.data) return;
    const key = `${today.data.date.slice(0, 7)}:${pace.categoryId}`;
    void (async () => {
      const sent = JSON.parse((await AsyncStorage.getItem(PACE_KEY)) ?? "[]") as string[];
      if (sent.includes(key)) return;
      await AsyncStorage.setItem(PACE_KEY, JSON.stringify([...sent.slice(-50), key]));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${pace.emoji} ${pace.name} is running ahead`,
          body: "A small heads-up from Tiki. Plenty of month left to even it out.",
          data: { url: "/money/budgets" },
        },
        trigger: null,
      });
    })();
  }, [pace, today.data]);
}
