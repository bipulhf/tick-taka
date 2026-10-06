import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";

const KEY = "tt.app-lock";

/**
 * The app-lock setting, kept on the phone so a cold start can lock before the
 * settings load. `undefined` while reading, `null` when never saved.
 */
export const appLockPref = createStore<boolean | null | undefined>(undefined);
resetOnSignOut(() => appLockPref.set(null));

export async function loadAppLockPref(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    appLockPref.set(raw === null ? null : raw === "1");
  } catch {
    appLockPref.set(null);
  }
}

export function saveAppLockPref(enabled: boolean): void {
  if (appLockPref.get() === enabled) return;
  appLockPref.set(enabled);
  void AsyncStorage.setItem(KEY, enabled ? "1" : "0").catch(() => {});
}
