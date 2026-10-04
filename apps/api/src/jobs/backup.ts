import type { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { toLocalDate } from "@tick-taka/shared/dates";

const BACKUP_RE = /^app-\d{4}-\d{2}-\d{2}\.db$/;

/**
 * Writes a clean copy of the database with VACUUM INTO and keeps the newest `keep`
 * nightly files. Backups stay on the server.
 */
export function runBackup(
  sqlite: Database,
  dir: string,
  now: number,
  timeZone: string,
  keep = 14,
): string {
  mkdirSync(dir, { recursive: true });
  const name = `app-${toLocalDate(now, timeZone)}.db`;
  const path = join(dir, name);
  try {
    unlinkSync(path);
  } catch {
    // no backup yet for today
  }
  sqlite.exec(`VACUUM INTO '${path.replaceAll("'", "''")}'`);
  const old = readdirSync(dir)
    .filter((file) => BACKUP_RE.test(file))
    .sort()
    .reverse()
    .slice(keep);
  for (const file of old) unlinkSync(join(dir, file));
  return path;
}
