import { tokenStore } from "@/lib/auth";
import { createStore, useStore } from "@/lib/store";

const KEY = "tt.spotter-dismissed";

/** Reads the stored list; anything unreadable is an empty one. Pure apart from `storage`. */
export function readDismissed(storage: Pick<Storage, "getItem"> | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

const storage = () => (typeof localStorage === "undefined" ? undefined : localStorage);

/** Charges the user said aren't subscriptions, so the spotter stops suggesting them. */
const dismissedStore = createStore<string[]>(readDismissed(storage()));

// They belong to whoever is signed in: signing out forgets them, as on the phone.
tokenStore.subscribe(() => {
  if (tokenStore.get()) return;
  dismissedStore.set([]);
  try {
    storage()?.removeItem(KEY);
  } catch {}
});

export function setDismissed(keys: string[]) {
  dismissedStore.set(keys);
  try {
    storage()?.setItem(KEY, JSON.stringify(keys));
  } catch {
    // Storage refused: the list lasts for this visit.
  }
}

export const useDismissed = () => useStore(dismissedStore);
