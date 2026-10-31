import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  notificationAccess,
  refreshNotificationAccess,
  reminderSyncError,
} from "@/lib/notifications";
import { privacyStore, usePrivacy } from "@/lib/privacy";
import { useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { useToday } from "@/lib/use-today";
import { resetOnSignOut } from "@/lib/user-data";
import { startReminderRefresh, stopReminderRefresh } from "./background-reminders";
import { rescheduleDue } from "./reminder-window";
import { type ReminderSettings, scheduleReminders } from "./schedule-reminders";

const PACE_KEY = "tt.pace-alerts";

// Signed out: the background refresh has nothing left to do.
resetOnSignOut(() => {
  void stopReminderRefresh().catch(() => {});
});

/** Never asks: that waits for the first reminder that matters (lib/notifications.ts). */
async function reschedule(settings: ReminderSettings) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await scheduleReminders(settings, privacyStore.get());
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
 * the app comes back to the front, and keeps the background refresh registered for
 * the days the app stays closed; no push service needed.
 */
export function useNotificationScheduler() {
  const { data: settings } = useSettings();
  const today = useToday();
  // Hide amounts changes what bill reminders say, so switching it reschedules them.
  const hidden = usePrivacy();
  // Allowing notifications (asked when a reminder first matters) schedules at once.
  const allowed = useStore(notificationAccess) === "granted";
  const lastRun = useRef<number | null>(null);
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);

  useEffect(() => {
    void refreshNotificationAccess().catch(() => {});
    startReminderRefresh().catch((error: unknown) =>
      console.warn("notifications: couldn't start the background refresh", error),
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on start and again each time Today's data refreshes (dataUpdatedAt), Hide amounts flips or notifications are allowed, not only when settings change.
  useEffect(() => {
    if (!settings) return;
    const timer = setTimeout(() => {
      lastRun.current = Date.now();
      void rescheduleSafely(settings);
    }, 1500);
    return () => clearTimeout(timer);
  }, [settings, today.dataUpdatedAt, hidden, allowed]);

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
