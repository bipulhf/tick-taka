import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore, useStore } from "./store";

const KEY = "tt.privacy";

/** Privacy mode: one tap blurs every amount on screen. */
export const privacyStore = createStore(false);

export async function loadPrivacy() {
  privacyStore.set((await AsyncStorage.getItem(KEY)) === "1");
}

export function togglePrivacy() {
  const next = !privacyStore.get();
  privacyStore.set(next);
  void AsyncStorage.setItem(KEY, next ? "1" : "0");
}

export const usePrivacy = () => useStore(privacyStore);
