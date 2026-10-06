import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_RE } from "../jobs/backup";
import { RECEIPT_NAME_RE } from "../modules/uploads/routes";

export interface UserPaths {
  db: string;
  uploads: string;
  backups: string;
}

/** Deletes only the files in `dir` whose names match, leaving folders (other users') alone. */
function removeMatching(dir: string, pattern: RegExp) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (pattern.test(name) && statSync(path).isFile()) rmSync(path, { force: true });
  }
}

/**
 * Deletes a user's database (with its WAL files), receipt photos and backups.
 * The owner's inherited (legacy) folders also hold every other user's
 * `users/` folder, so for them only their own files are removed.
 */
export function deleteUserFiles(paths: UserPaths, legacy: boolean): void {
  if (paths.db !== ":memory:") {
    for (const suffix of ["", "-wal", "-shm", "-journal"])
      rmSync(`${paths.db}${suffix}`, { force: true });
  }
  if (legacy) {
    removeMatching(paths.uploads, RECEIPT_NAME_RE);
    removeMatching(paths.backups, BACKUP_RE);
    return;
  }
  rmSync(paths.uploads, { recursive: true, force: true });
  rmSync(paths.backups, { recursive: true, force: true });
}
