import * as Notifications from "expo-notifications";
import { createStore } from "./store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Whether reminders can ring; "denied" shows a banner with a way to Settings. */
export const notificationAccess = createStore<"unknown" | "granted" | "denied">("unknown");

/** Why the last reminder refresh failed, if it did; shown quietly in Settings. */
export const reminderSyncError = createStore<string | null>(null);

/** Reads the permission without asking (it can change in the phone's Settings). */
export async function refreshNotificationAccess(): Promise<void> {
  const current = await Notifications.getPermissionsAsync();
  notificationAccess.set(current.granted ? "granted" : current.canAskAgain ? "unknown" : "denied");
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    notificationAccess.set("granted");
    return true;
  }
  const asked = current.canAskAgain ? await Notifications.requestPermissionsAsync() : current;
  notificationAccess.set(asked.granted ? "granted" : "denied");
  return asked.granted;
}

const FOCUS_ID = "focus-period-end";

/** Rings when a focus work or break period ends, even if the app is in the background. */
export async function scheduleFocusEnd(endsAt: number, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
  if (!(await ensureNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: { title, body, data: { url: "/focus" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
  });
}

export async function cancelFocusEnd(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}
