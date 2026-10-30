import { createStore } from "./store";

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Errors stay a little longer and are announced assertively. */
  tone: "info" | "error";
}

/** The single toast slot. Deleting shows Undo here instead of an "Are you sure?" dialog. */
export const toastStore = createStore<Toast | null>(null);
let nextId = 1;

export function notify(message: string, action?: { label: string; onPress: () => void }): void {
  toastStore.set({
    id: nextId++,
    message,
    actionLabel: action?.label,
    onAction: action?.onPress,
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
