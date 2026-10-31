import { createStore } from "./store";

export interface Snack {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A second action before the first: "Split" beside "Undo" after a salary lands. */
  secondLabel?: string;
  onSecond?: () => void;
}

/** The single snackbar slot. Deleting shows Undo here instead of an "Are you sure?" dialog. */
export const snackStore = createStore<Snack | null>(null);
let nextId = 1;

/** Extra room (dp) the snackbar keeps above the tab bar, for bars that float there. */
export const snackLiftStore = createStore(0);

type SnackAction = { label: string; onPress: () => void };

export function notify(message: string, action?: SnackAction, second?: SnackAction): void {
  snackStore.set({
    id: nextId++,
    message,
    actionLabel: action?.label,
    onAction: action?.onPress,
    secondLabel: second?.label,
    onSecond: second?.onPress,
  });
}
