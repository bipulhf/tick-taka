import { createStore, useStore } from "./store";

/** Browser preferences: they stay when someone signs out, like the phone's. */
function stored<T>(key: string, fallback: T, parse: (raw: string) => T | undefined) {
  let initial = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) initial = parse(raw) ?? fallback;
  } catch {}
  const store = createStore<T>(initial);
  const set = (value: T) => {
    store.set(value);
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {}
  };
  return { store, set };
}

/** Privacy mode: one click hides every amount on screen. */
const privacy = stored("tt.privacy", false, (raw) => raw === "true");
export const privacyStore = privacy.store;
export const togglePrivacy = () => privacy.set(!privacyStore.get());
export const usePrivacy = () => useStore(privacyStore);

export interface FeedbackPrefs {
  sounds: boolean;
}
const feedback = stored<FeedbackPrefs>("tt.feedback", { sounds: true }, (raw) => ({
  sounds: true,
  ...(JSON.parse(raw) as Partial<FeedbackPrefs>),
}));
export const feedbackPrefsStore = feedback.store;
export const setFeedbackPrefs = (patch: Partial<FeedbackPrefs>) =>
  feedback.set({ ...feedbackPrefsStore.get(), ...patch });
export const useFeedbackPrefs = () => useStore(feedbackPrefsStore);

/** The sidebar folded to icons on a wide screen. */
const rail = stored("tt.sidebar-rail", false, (raw) => raw === "true");
export const railStore = rail.store;
export const toggleRail = () => rail.set(!railStore.get());
