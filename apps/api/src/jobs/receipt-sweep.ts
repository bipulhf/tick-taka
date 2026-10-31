import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { isNotNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { transactions } from "../db/schema/money";
import { RECEIPT_NAME_RE } from "../modules/uploads/routes";

/**
 * How long an upload may sit with no transaction pointing to it. Generous, so a
 * phone that uploads a photo and saves the expense from its offline queue days
 * later still finds the file.
 */
export const RECEIPT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deletes receipt photos in the user's own uploads folder that no transaction
 * points to: uploaded but never saved, or replaced or removed on an edit. Files a
 * deleted (restorable) transaction points to are kept, so Undo still shows the
 * photo. Only files directly in `uploadsDir` whose names look like receipts are
 * touched; the owner's legacy folder also holds every other user's `users/`
 * folder, which this never enters.
 */
export function sweepReceipts(
  db: Db,
  uploadsDir: string,
  now: number,
  graceMs = RECEIPT_GRACE_MS,
): { removed: number } {
  if (!existsSync(uploadsDir)) return { removed: 0 };
  const used = new Set(
    db
      .select({ path: transactions.receiptPath })
      .from(transactions)
      .where(isNotNull(transactions.receiptPath))
      .all()
      .map((row) => row.path),
  );
  let removed = 0;
  for (const name of readdirSync(uploadsDir)) {
    if (!RECEIPT_NAME_RE.test(name) || used.has(name)) continue;
    const path = join(uploadsDir, name);
    const stat = statSync(path);
    if (!stat.isFile() || now - stat.mtimeMs < graceMs) continue;
    rmSync(path, { force: true });
    removed++;
  }
  return { removed };
}
