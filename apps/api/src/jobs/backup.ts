import { Database } from "bun:sqlite";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { toLocalDate } from "@tick-taka/shared/dates";

/** A nightly backup's file name. */
export const BACKUP_RE = /^app-\d{4}-\d{2}-\d{2}\.db$/;

/** Opens a backup read-only and runs SQLite's integrity check on it. */
export function checkBackup(path: string): void {
  const copy = new Database(path, { readonly: true });
  try {
    const rows = copy.query<{ integrity_check: string }, []>("PRAGMA integrity_check").all();
    const result = rows.map((row) => row.integrity_check).join("; ");
    if (result !== "ok") throw new Error(`Backup ${path} failed its integrity check: ${result}`);
  } finally {
    copy.close();
  }
}

/**
 * Writes a clean copy of the database with VACUUM INTO, checks it can be read
 * back whole, and only then keeps it (replacing today's earlier copy, if any)
 * and trims to the newest `keep` nightly files. A copy that fails the check is
 * deleted and the error thrown, so the job is retried and older backups stay.
 */
export function runBackup(
  sqlite: Database,
  dir: string,
  now: number,
  timeZone: string,
  keep = 14,
): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `app-${toLocalDate(now, timeZone)}.db`);
  const partial = `${path}.partial`;
  rmSync(partial, { force: true });
  sqlite.exec(`VACUUM INTO '${partial.replaceAll("'", "''")}'`);
  try {
    checkBackup(partial);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  renameSync(partial, path);
  const old = readdirSync(dir)
    .filter((file) => BACKUP_RE.test(file))
    .sort()
    .reverse()
    .slice(keep);
  for (const file of old) unlinkSync(join(dir, file));
  return path;
}

/** The nearest existing folder at or above `path`, to ask which disk it is on. */
function existingAncestor(path: string): string {
  let current = resolve(path);
  while (!existsSync(current) && dirname(current) !== current) current = dirname(current);
  return current;
}

/**
 * True when backups would land on the same disk (device) as the live data, so a
 * disk failure would take both. Used to warn at start-up.
 */
export function backupsShareDisk(dataDir: string, backupsDir: string): boolean {
  if (dataDir === ":memory:") return false;
  return statSync(existingAncestor(dataDir)).dev === statSync(existingAncestor(backupsDir)).dev;
}
