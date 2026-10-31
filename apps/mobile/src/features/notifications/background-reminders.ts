import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { currentToken } from "@/lib/http";
import { loadPrivacy, privacyStore } from "@/lib/privacy";
import { TOKEN_KEY } from "@/lib/session";
import { fetchSettings, scheduleReminders } from "./schedule-reminders";

const TASK_NAME = "tt-reminder-refresh";
/** Android runs it about this often (WorkManager decides, and only with a network). */
const INTERVAL_MINUTES = 12 * 60;

/**
 * Re-plans reminders while the app is closed, so they keep coming 30 days ahead even
 * when it isn't opened for weeks. Runs without any screen: the token comes from secure
 * storage and Hide amounts from the phone's preferences, then everything else is
 * fetched fresh. Signed out, offline or without permission it does nothing, and a
 * failure leaves the reminders already set alone (see scheduleReminders).
 */
async function refreshInBackground(): Promise<void> {
  const token = currentToken() ?? (await SecureStore.getItemAsync(TOKEN_KEY));
  if (!token) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  if ((await NetInfo.fetch()).isConnected === false) return;
  const options = { headers: { authorization: `Bearer ${token}` } };
  await loadPrivacy();
  const settings = await fetchSettings(options);
  await scheduleReminders(settings, privacyStore.get(), options);
}

// Defined when the bundle loads (index.ts imports this), as Android may start the JS
// for this task alone.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await refreshInBackground();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("notifications: background refresh failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Asks Android to run the refresh from now on; doing it again changes nothing. */
export async function startReminderRefresh(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return;
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
}

/** Signed out: nothing to refresh. */
export async function stopReminderRefresh(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TASK_NAME))
    await BackgroundTask.unregisterTaskAsync(TASK_NAME);
}
