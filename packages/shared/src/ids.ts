import { monotonicFactory } from "ulid";

const nextUlid = monotonicFactory();

/** New sortable ULID. Generated on the phone so offline-created records never clash. */
export function newId(now: number = Date.now()): string {
  return nextUlid(now);
}
