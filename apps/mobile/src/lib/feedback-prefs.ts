import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore, useStore } from "./store";

const KEY = "tt.feedback";

export interface FeedbackPrefs {
  sounds: boolean;
  haptics: boolean;
}

/** Sounds and vibration are a phone preference, so they stay when someone signs out. */
export const feedbackPrefsStore = createStore<FeedbackPrefs>({ sounds: true, haptics: true });

export async function loadFeedbackPrefs() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) feedbackPrefsStore.set({ ...feedbackPrefsStore.get(), ...JSON.parse(raw) });
}

export function setFeedbackPrefs(patch: Partial<FeedbackPrefs>) {
  const next = { ...feedbackPrefsStore.get(), ...patch };
  feedbackPrefsStore.set(next);
  void AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export const useFeedbackPrefs = () => useStore(feedbackPrefsStore);
