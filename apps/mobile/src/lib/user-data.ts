import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { sweepExports } from "./export-sweep";
import { outbox } from "./outbox";
import { persister, queryClient } from "./query-client";

/** Phone preferences, not anyone's data: they stay when someone signs out. */
const DEVICE_KEYS = new Set(["tt.theme", "tt.privacy", "tt.feedback"]);

const resets = new Set<() => void>();

/** Modules holding a user's data in memory register how to empty it on sign-out. */
export function resetOnSignOut(reset: () => void): void {
  resets.add(reset);
}

/**
 * Leaves nothing of the signed-out user on the phone for the next person: cached
 * screens, queued offline writes, chat, focus session, widget numbers, a full data
 * export left for sharing and scheduled reminders.
 */
export async function clearUserData(): Promise<void> {
  await queryClient.cancelQueries();
  await outbox.clear();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  for (const reset of resets) reset();
  const keys = await AsyncStorage.getAllKeys();
  // Every JSON export still kept for the app it was shared to.
  sweepExports(0);
  await Promise.all([
    persister.removeClient(),
    AsyncStorage.multiRemove(keys.filter((key) => !DEVICE_KEYS.has(key))),
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}),
  ]);
}
