import { createStore } from "./store";

/** App-wide UI switches that live outside the URL. */
export const paletteOpenStore = createStore(false);
export const shortcutsOpenStore = createStore(false);
export const assistantOpenStore = createStore(false);

/** Asks the top bar's quick-add field to take focus (N or / anywhere). */
export const quickAddFocusStore = createStore(0);
export const focusQuickAdd = () => quickAddFocusStore.set(quickAddFocusStore.get() + 1);

/** Whether a key event came from somewhere typing happens, where shortcuts stay quiet. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "range"].includes(type);
}
