import { plural } from "@/lib/format";

/** The word typed to confirm, so deleting can't happen from one stray tap. */
export const DELETE_WORD = "DELETE";

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD;
}

/** What goes, in one sentence, including changes still waiting on this phone. */
export function deleteAccountSummary(pending: number): string {
  const unsynced = pending > 0 ? `, plus ${plural(pending, "change")} not yet synced` : "";
  return `This permanently deletes your account and everything in it from the server: tasks, money records, receipt photos and backups${unsynced}. It can't be undone.`;
}
