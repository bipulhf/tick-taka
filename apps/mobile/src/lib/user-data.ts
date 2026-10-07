import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { isExportFile } from "./export-file";
import { outbox } from "./outbox";
import { persister, queryClient } from "./query-client";

/** Phone preferences, not anyone's data: they stay when someone signs out. */
const DEVICE_KEYS = new Set(["tt.theme", "tt.privacy", "tt.feedback"]);

const resets = new Set<() => void>();

/** Modules holding a user's data in memory register how to empty it on sign-out. */
export function resetOnSignOut(reset: () => void): void {
  resets.add(reset);
}

/** A JSON export a share sheet was opened for, should one still be in the cache folder. */
function deleteExportFiles(): void {
  try {
    for (const item of new Directory(Paths.cache).list())
      if (item instanceof File && isExportFile(item.name)) item.delete();
  } catch (error) {
    console.warn("sign-out: couldn't clear export files", error);
  }
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
  deleteExportFiles();
  await Promise.all([
    persister.removeClient(),
    AsyncStorage.multiRemove(keys.filter((key) => !DEVICE_KEYS.has(key))),
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}),
  ]);
}
