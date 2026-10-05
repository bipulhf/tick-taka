import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { persister, queryClient } from "./query-client";

/** Phone preferences, not anyone's data: they stay when someone signs out. */
const DEVICE_KEYS = new Set(["tt.theme", "tt.privacy"]);

const resets = new Set<() => void>();

/** Modules holding a user's data in memory register how to empty it on sign-out. */
export function resetOnSignOut(reset: () => void): void {
  resets.add(reset);
}

/**
 * Leaves nothing of the signed-out user on the phone for the next person: cached
 * screens, queued offline writes, chat, SMS cards, focus session, widget numbers
 * and scheduled reminders.
 */
export async function clearUserData(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  for (const reset of resets) reset();
  const keys = await AsyncStorage.getAllKeys();
  await Promise.all([
    persister.removeClient(),
    AsyncStorage.multiRemove(keys.filter((key) => !DEVICE_KEYS.has(key))),
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}),
  ]);
}
