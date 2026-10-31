import { createStore } from "./store";

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A second action before the first: "Split" beside "Undo" after a salary lands. */
  secondLabel?: string;
  onSecond?: () => void;
  /** Errors stay a little longer and are announced assertively. */
  tone: "info" | "error";
}

/** The single toast slot. Deleting shows Undo here instead of an "Are you sure?" dialog. */
export const toastStore = createStore<Toast | null>(null);
let nextId = 1;

type ToastAction = { label: string; onPress: () => void };

export function notify(message: string, action?: ToastAction, second?: ToastAction): void {
  toastStore.set({
    id: nextId++,
    message,
    actionLabel: action?.label,
    onAction: action?.onPress,
    secondLabel: second?.label,
    onSecond: second?.onPress,
    tone: "info",
  });
}

export function notifyError(message: string, action?: { label: string; onPress: () => void }) {
  toastStore.set({
    id: nextId++,
    message,
    actionLabel: action?.label,
    onAction: action?.onPress,
    tone: "error",
  });
}
