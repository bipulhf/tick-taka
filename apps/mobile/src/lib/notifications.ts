import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";
import { accessFrom, askDecision, type PermissionState } from "./notification-ask";
import { createStore } from "./store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Whether reminders can ring. "unknown" until read; "unasked" before any reminder
 * needed it; "denied" shows a banner in Settings with a way to turn them on.
 */
export const notificationAccess = createStore<"unknown" | "unasked" | "granted" | "denied">(
  "unknown",
);

/** Why the last reminder refresh failed, if it did; shown quietly in Settings. */
export const reminderSyncError = createStore<string | null>(null);

/** Kept when someone signs out (see user-data.ts): it is about this install. */
export const ASKED_KEY = "tt.notify-asked";

async function readPermission(): Promise<PermissionState> {
  const [current, asked] = await Promise.all([
    Notifications.getPermissionsAsync(),
    AsyncStorage.getItem(ASKED_KEY).catch(() => null),
  ]);
  return { granted: current.granted, canAskAgain: current.canAskAgain, askedBefore: asked === "1" };
}

/** Reads the permission without asking (it can change in the phone's Settings). */
export async function refreshNotificationAccess(): Promise<void> {
  notificationAccess.set(accessFrom(await readPermission()));
}

/** Android's own prompt; remembers it was shown, so the app never asks twice. */
async function requestPermission(): Promise<boolean> {
  await AsyncStorage.setItem(ASKED_KEY, "1").catch(() => {});
  const answer = await Notifications.requestPermissionsAsync();
  notificationAccess.set(answer.granted ? "granted" : "denied");
  return answer.granted;
}

let asking: Promise<boolean> | null = null;

/**
 * Called the first time a reminder would matter (a timed task, a bill, a habit
 * reminder, the shutdown time). Says in one line what the reminder will do, then shows
 * Android's prompt if they want it. Asks once per install; after that it only reports
 * whether reminders can ring. Resolves true when they can.
 */
export function askForNotifications(why: string): Promise<boolean> {
  asking ??= (async () => {
    const state = await readPermission();
    const decision = askDecision(state);
    if (decision !== "ask") {
      notificationAccess.set(accessFrom(state));
      return decision === "granted";
    }
    const allow = await new Promise<boolean>((resolve) =>
      Alert.alert(
        "Allow notifications?",
        why,
        [
          { text: "Not now", style: "cancel", onPress: () => resolve(false) },
          { text: "Allow", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (allow) return requestPermission();
    await AsyncStorage.setItem(ASKED_KEY, "1").catch(() => {});
    notificationAccess.set("denied");
    return false;
  })().finally(() => {
    asking = null;
  });
  return asking;
}

/**
 * The banner's button in Settings: Android's prompt if it will still show one,
 * otherwise the app's page in the phone's Settings.
 */
export async function turnOnNotifications(): Promise<void> {
  const state = await readPermission();
  if (state.granted) return void notificationAccess.set("granted");
  if (state.canAskAgain && (await requestPermission())) return;
  await Linking.openSettings();
}

const FOCUS_ID = "focus-period-end";

/** Rings when a focus work or break period ends, even if the app is in the background. */
export async function scheduleFocusEnd(endsAt: number, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
  if (!(await askForNotifications("Tick & Taka can tell you when this focus period ends."))) return;
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: { title, body, data: { url: "/focus" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
  });
}

/**
 * The same, from a home-screen widget: it can't ask for permission there, so the
 * end only rings if notifications are already allowed.
 */
export async function scheduleFocusEndQuietly(
  endsAt: number,
  title: string,
  body: string,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: { title, body, data: { url: "/focus" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
  });
}

export async function cancelFocusEnd(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}
