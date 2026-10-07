/**
 * The full JSON export is written to the cache folder only so the share sheet can
 * hand it on. It holds every record in plain text, so it is swept once the app it went
 * to has had time to read it, and on sign-out; these name it, so both find the same
 * files.
 */
const PREFIX = "tick-taka-export-";

/**
 * How long an export stays after it was made. The share sheet returns before some
 * apps read the file (Drive's upload, a mail sent later), so it can't go at once.
 */
export const EXPORT_KEEP_MS = 60 * 60 * 1000;

/** `tick-taka-export-2026-10-07.json` */
export function exportFileName(now: Date): string {
  return `${PREFIX}${now.toISOString().slice(0, 10)}.json`;
}

export function isExportFile(name: string): boolean {
  return name.startsWith(PREFIX) && name.endsWith(".json");
}

export interface CachedFile {
  name: string;
  /** Epoch ms; null when it can't be read. */
  lastModified: number | null;
}

/**
 * The exports to delete now: those made `keepMs` or more ago (all of them when
 * `keepMs` is 0). One whose time can't be read counts as old.
 */
export function exportsToSweep(
  files: readonly CachedFile[],
  now: number,
  keepMs: number,
): string[] {
  return files
    .filter((file) => isExportFile(file.name))
    .filter(
      (file) => keepMs <= 0 || file.lastModified === null || now - file.lastModified >= keepMs,
    )
    .map((file) => file.name);
}
