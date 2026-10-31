import { and, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/client";
import { accounts } from "../../db/schema/money";
import { accountDeleted } from "../../lib/errors";

/**
 * Refuses a write that names an account that was deleted (it can still be restored,
 * so the row is there and the foreign key alone would let it through). Missing ids
 * are left to the foreign key, which answers invalid_reference.
 */
export function assertAccountsLive(db: Db, ...ids: (string | null | undefined)[]): void {
  const named = ids.filter((id): id is string => Boolean(id));
  if (named.length === 0) return;
  const deleted = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(inArray(accounts.id, named), isNotNull(accounts.deletedAt)))
    .get();
  if (deleted) throw accountDeleted();
}
