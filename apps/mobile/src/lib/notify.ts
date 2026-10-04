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

export function notify(message: string, action?: { label: string; onPress: () => void }): void {
  snackStore.set({ id: nextId++, message, actionLabel: action?.label, onAction: action?.onPress });
}
