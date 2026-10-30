/** The word typed to confirm, so deleting can't happen from one stray click. */
export const DELETE_WORD = "DELETE";

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD;
}

/**
 * The typed word, and the user's own word that their copy is saved (or not wanted):
 * a finished download doesn't prove the file landed where they can find it.
 */
export function canDeleteAccount(typed: string, copyConfirmed: boolean): boolean {
  return isDeleteConfirmed(typed) && copyConfirmed;
}

/** Under "1. Keep a copy": before and after the export was downloaded. */
export function exportStepNote(downloaded: boolean): string {
  return downloaded
    ? "Export downloaded. Open it from your downloads and check it's all there before you go on."
    : "The export is one file with everything in it. Save it, then check it arrived before you go on.";
}

/** What goes, in one sentence. Nothing waits in the browser, so nothing else is lost. */
export const DELETE_ACCOUNT_SUMMARY =
  "This permanently deletes your account and everything in it from the server: tasks, money records, receipt photos and backups. It can't be undone.";

/** `tick-taka-export-2026-10-07.json`, the same name the phone gives its export. */
export function exportFileName(now: Date): string {
  return `tick-taka-export-${now.toISOString().slice(0, 10)}.json`;
}
