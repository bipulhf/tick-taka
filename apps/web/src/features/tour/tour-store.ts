import { createStore } from "@/lib/store";

/** The step the tour is on, or null when it isn't running. */
export const tourStore = createStore<number | null>(null);

const doneKey = (userId: string) => `tt.tour-done:${userId}`;

/** Whether this person has finished or skipped the tour in this browser. */
export function tourDone(userId: string): boolean {
  try {
    return localStorage.getItem(doneKey(userId)) === "1";
  } catch {
    return true;
  }
}

export function markTourDone(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(doneKey(userId), "1");
  } catch {}
}

export const startTour = () => tourStore.set(0);
