import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
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
