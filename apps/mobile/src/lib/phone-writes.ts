/**
 * Record ids the phone itself wrote recently (through the outbox). When an
 * assistant turn's stream drops, the server's changes from that window are listed
 * as Tiki's, with Undo; ids in here were the phone's own offline writes landing at
 * the same time, and must not be offered for undo as if Tiki made them.
 */

/** Long enough to cover a dropped turn's recovery window. */
const KEEP_MS = 60 * 60_000;
const MAX = 500;
/** Record ids are ULIDs. */
const RECORD_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The record ids a write names: in its path (`/tasks/<id>`), its body and its reply. */
export function idsOfWrite(path: string, body: unknown, response: unknown): string[] {
  const ids: string[] = [];
  // Only a record id in the path, not an action word like /shopping/checkout.
  const fromPath = path.split("?", 1)[0]?.split("/")[2];
  if (fromPath && RECORD_ID.test(fromPath)) ids.push(fromPath);
  for (const value of [body, response]) {
    if (!value || typeof value !== "object") continue;
    for (const key of ["id", "transactionId"]) {
      const id = (value as Record<string, unknown>)[key];
      if (typeof id === "string" && id) ids.push(id);
    }
  }
  return ids;
}

/** A small time-bounded set; separate from the outbox so it can be tested alone. */
export function createPhoneWrites(now: () => number = Date.now) {
  const written = new Map<string, number>();
  const prune = () => {
    const cutoff = now() - KEEP_MS;
    for (const [id, at] of written) if (at < cutoff || written.size > MAX) written.delete(id);
  };
  return {
    record(path: string, body: unknown, response: unknown): void {
      for (const id of idsOfWrite(path, body, response)) written.set(id, now());
      prune();
    },
    ids(): Set<string> {
      prune();
      return new Set(written.keys());
    },
  };
}

export const phoneWrites = createPhoneWrites();
