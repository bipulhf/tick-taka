import { createStore } from "./store";

export interface Snack {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** The single snackbar slot. Deleting shows Undo here instead of an "Are you sure?" dialog. */
export const snackStore = createStore<Snack | null>(null);
let nextId = 1;

/** Extra room (dp) the snackbar keeps above the tab bar, for bars that float there. */
export const snackLiftStore = createStore(0);

export function notify(message: string, action?: { label: string; onPress: () => void }): void {
  snackStore.set({ id: nextId++, message, actionLabel: action?.label, onAction: action?.onPress });
}
