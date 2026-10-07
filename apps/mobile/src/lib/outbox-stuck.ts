import { addTies, type OutboxEntry, type OutboxRequest, tiedTo, tiesOf } from "./outbox-policy";

/** Which stuck group an entry belongs to: the write that got stuck (older builds: its own). */
const groupKey = (entry: OutboxEntry): string => entry.stuckWith ?? entry.id;

/** A write that joined a stuck group as it was queued; it waits there for Retry. */
export class SetAsideError extends Error {
  constructor() {
    super("Set aside with a change the server keeps failing on");
    this.name = "SetAsideError";
  }
}

/**
 * Writes the server kept failing on, each with the later writes set aside with it, kept
 * until the user retries or discards the group. The outbox queue owns sending and
 * saving; this keeps the groups.
 */
export class StuckWrites {
  private parked: OutboxEntry[] = [];

  /** Writes the server kept failing on, oldest first. */
  all(): readonly OutboxEntry[] {
    return this.parked;
  }

  get size(): number {
    return this.parked.length;
  }

  /** The stuck write and the writes set aside with it, oldest first. */
  group(id: string): OutboxEntry[] {
    const entry = this.parked.find((e) => e.id === id);
    if (!entry) return [];
    const key = groupKey(entry);
    return this.parked.filter((e) => groupKey(e) === key);
  }

  /** Takes these entries out of the stuck list (Retry, Discard). */
  take(group: readonly OutboxEntry[]): void {
    this.parked = this.parked.filter((e) => !group.includes(e));
  }

  /**
   * Undo of a discard: the group is stuck again, as it was, but for entries already
   * back in the queue (`queued`) or here. Returns whether any came back.
   */
  restore(group: readonly OutboxEntry[], queued: readonly OutboxEntry[]): boolean {
    const known = new Set([...queued, ...this.parked].map((e) => e.id));
    const back = group.filter((e) => !known.has(e.id));
    if (back.length === 0) return false;
    this.parked = [...this.parked, ...back];
    return true;
  }

  /** Stuck writes read from storage go before the ones set aside since. */
  addSaved(saved: readonly OutboxEntry[]): void {
    this.parked = [...saved, ...this.parked];
  }

  find(match: (entry: OutboxEntry) => boolean): OutboxEntry | undefined {
    return this.parked.find(match);
  }

  remove(entry: OutboxEntry): void {
    this.parked = this.parked.filter((e) => e !== entry);
  }

  clear(): void {
    this.parked = [];
  }

  /**
   * Sets a write the server keeps failing on aside, so the ones behind it can go.
   * Every later write tied to it (see tiedTo), or to one of those, goes aside with it,
   * in order: sent first, it would get 404 and be lost, or land out of order. Returns
   * the group and the writes that can still go.
   */
  park(
    entry: OutboxEntry,
    queued: readonly OutboxEntry[],
  ): { group: OutboxEntry[]; rest: OutboxEntry[] } {
    const ties = tiesOf([entry.request]);
    const group: OutboxEntry[] = [entry];
    const rest: OutboxEntry[] = [];
    for (const later of queued) {
      if (later === entry) continue;
      if (tiedTo(later.request, ties)) {
        group.push(later);
        addTies(ties, later.request);
      } else rest.push(later);
    }
    const key = groupKey(entry);
    this.parked = [...this.parked, ...group.map((e) => ({ ...e, stuckWith: key }))];
    return { group, rest };
  }

  /**
   * Sets a new write aside with the stuck group it is tied to (see tiedTo), if any.
   * Returns whether it was.
   */
  joinGroup(entry: OutboxEntry): boolean {
    const head = this.headFor(entry.request);
    if (!head) return false;
    this.parked.push({ ...entry, stuckWith: head });
    return true;
  }

  /** The stuck group a new write must join, because it is tied to it (see tiedTo). */
  private headFor(request: OutboxRequest): string | null {
    const groups = new Map<string, OutboxRequest[]>();
    for (const entry of this.parked) {
      const key = groupKey(entry);
      groups.set(key, [...(groups.get(key) ?? []), entry.request]);
    }
    for (const [key, requests] of groups) if (tiedTo(request, tiesOf(requests))) return key;
    return null;
  }
}
