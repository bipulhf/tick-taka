import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore, useStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";

const KEY = "tt.spotter-dismissed";

/** Charges the user said aren't subscriptions, so the spotter stops suggesting them. */
const dismissedStore = createStore<string[]>([]);
resetOnSignOut(() => {
  dismissedStore.set([]);
  void AsyncStorage.removeItem(KEY);
});

export async function loadDismissed() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) dismissedStore.set(JSON.parse(raw) as string[]);
}

export function setDismissed(keys: string[]) {
  dismissedStore.set(keys);
  void AsyncStorage.setItem(KEY, JSON.stringify(keys));
}

export const useDismissed = () => useStore(dismissedStore);
