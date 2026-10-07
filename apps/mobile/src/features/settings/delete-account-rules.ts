import { plural } from "@/lib/format";

/** The word typed to confirm, so deleting can't happen from one stray tap. */
export const DELETE_WORD = "DELETE";

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD;
}

/**
 * The typed word, and the user's own word that their copy is saved (or not wanted):
 * the share sheet returning doesn't prove the app it went to saved the file.
 */
export function canDeleteAccount(typed: string, copyConfirmed: boolean): boolean {
  return isDeleteConfirmed(typed) && copyConfirmed;
}

/** Under "1. Keep a copy": before and after the share sheet was opened with the export. */
export function exportStepNote(shared: boolean): string {
  return shared
    ? "Export shared. Open it where you sent it (Drive, Files, your email) and check it's all there before you go on."
    : "The export is one file with everything in it. Save it, then check it arrived before you go on.";
}

/** What goes, in one sentence, including changes still waiting on this phone. */
export function deleteAccountSummary(pending: number): string {
  const unsynced = pending > 0 ? `, plus ${plural(pending, "change")} not yet synced` : "";
  return `This permanently deletes your account and everything in it from the server: tasks, money records, receipt photos and backups${unsynced}. It can't be undone.`;
}
