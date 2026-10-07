/**
 * The full JSON export is written to the cache folder only so the share sheet can
 * hand it on. It holds every record in plain text, so it is deleted after sharing and
 * swept on sign-out; these name it, so both find the same files.
 */
const PREFIX = "tick-taka-export-";

/** `tick-taka-export-2026-10-07.json` */
export function exportFileName(now: Date): string {
  return `${PREFIX}${now.toISOString().slice(0, 10)}.json`;
}

export function isExportFile(name: string): boolean {
  return name.startsWith(PREFIX) && name.endsWith(".json");
}
