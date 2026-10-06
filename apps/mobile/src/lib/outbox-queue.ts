import {
  classifyFailure,
  type FailureInfo,
  followCreatedRecords,
  isServerFault,
  mayHaveReachedServer,
  mentionsAny,
  type OutboxEntry,
  type OutboxRequest,
  type PersistedOutbox,
  parsePersistedOutbox,
  retryDelay,
  STUCK_AFTER,
  writtenIds,
} from "./outbox-policy";

export interface OutboxDeps {
  /** Sends one write; resolves with the parsed reply or throws. */
  send(request: OutboxRequest): Promise<unknown>;
  /** Turns a thrown error into status / unreachable for the policy. */
  describe(error: unknown): FailureInfo;
  /** Whether writes may go out now: online, signed in, session not expired. */
  canSend(): boolean;
  load(): Promise<unknown>;
  save(state: PersistedOutbox): Promise<void>;
  /** The write landed (or was already there). */
  onSent?(request: OutboxRequest, response: unknown): void;
  /** The server refused the write for good; it has left the queue. */
  onRejected?(request: OutboxRequest, error: unknown): void;
  /** The server kept failing on this write; it was set aside so later ones can go. */
  onStuck?(request: OutboxRequest, error: unknown): void;
  /** The user discarded a stuck write. */
  onDiscarded?(request: OutboxRequest): void;
  now?(): number;
  delay?(attempts: number): number;
  newId?(): string;
}

interface Waiter {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

let counter = 0;
const defaultId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

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
 * Every write goes through one queue, sent one at a time in the order made. An entry
 * stays saved until the server has it, so a write that is sending when the app is
 * killed is sent again on the next start. Unreachable servers, 503 and 429 retry
 * forever with a capped backoff; a 401 pauses the queue without dropping anything;
 * only a final 4xx takes a write out. A write our API keeps answering with another
 * 5xx is set aside as stuck after STUCK_AFTER tries, kept until the user retries or
 * discards it, so one bad write can't hold back every write behind it.
 */
export class OutboxQueue {
  private entries: OutboxEntry[] = [];
  private parked: OutboxEntry[] = [];
  private userId: string | null = null;
  private loaded = false;
  private reading = false;
  /** The saved queue couldn't be read on the last try. */
  private unreadable = false;
  /** Writes from an older storage format, waiting for the saved queue to be read. */
  private legacy: OutboxRequest[] = [];
  /** Cleared before the saved queue was read: what's on disk is not to be sent. */
  private discardSaved = false;
  private running = false;
  /** The write being sent right now; it can't be taken back. */
  private inFlight: OutboxEntry | null = null;
  private wake: (() => void) | null = null;
  private saving: Promise<void> = Promise.resolve();
  private readonly waiters = new Map<string, Waiter>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: OutboxDeps) {}

  /** Number of writes not yet on the server, stuck ones included. */
  get size(): number {
    return this.entries.length + this.parked.length;
  }

  /** Writes still being sent (or waiting to be), not counting stuck ones. */
  get sending(): number {
    return this.entries.length;
  }

  /** Writes the server kept failing on, oldest first. */
  stuck(): readonly OutboxEntry[] {
    return this.parked;
  }

  /** The stuck write and the writes set aside with it, oldest first. */
  stuckGroup(id: string): OutboxEntry[] {
    const entry = this.parked.find((e) => e.id === id);
    if (!entry) return [];
    const key = groupKey(entry);
    return this.parked.filter((e) => groupKey(e) === key);
  }

  /** Sends a stuck write and the writes set aside with it again, in order, after the writes queued now. */
  retryStuck(id: string): void {
    this.requeue(this.stuckGroup(id));
  }

  /** Sends every stuck write again, in the order they were made. */
  retryAllStuck(): void {
    this.requeue(this.parked);
  }

  /**
   * Drops a stuck write for good, with the writes set aside with it (they name its
   * record, so they can't land without it). Returns them, for an Undo.
   */
  discardStuck(id: string): OutboxEntry[] {
    const group = this.stuckGroup(id);
    if (group.length === 0) return group;
    this.parked = this.parked.filter((e) => !group.includes(e));
    this.persist();
    this.changed();
    for (const entry of group) this.deps.onDiscarded?.(entry.request);
    return group;
  }

  /** Undo of a discard: the group is stuck again, as it was. */
  restoreStuck(group: readonly OutboxEntry[]): void {
    const known = new Set([...this.entries, ...this.parked].map((e) => e.id));
    const back = group.filter((e) => !known.has(e.id));
    if (back.length === 0) return;
    this.parked = [...this.parked, ...back];
    this.persist();
    this.changed();
  }

  private requeue(group: readonly OutboxEntry[]): void {
    if (group.length === 0) return;
    this.parked = this.parked.filter((e) => !group.includes(e));
    for (const { stuckWith: _, ...entry } of group)
      this.entries.push({
        ...entry,
        attempts: 0,
        serverFailures: 0,
        // A 5xx may have landed: a repeat-of-delivered reply then counts as done.
        maybeDelivered: entry.maybeDelivered || entry.attempts > 0,
      });
    this.persist();
    this.changed();
    this.kick();
  }

  get owner(): string | null {
    return this.userId;
  }

  /** The saved queue couldn't be read yet; writes are held until it can. */
  get savedUnreadable(): boolean {
    return this.unreadable;
  }

  snapshot(): readonly OutboxEntry[] {
    return this.entries;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reads the saved queue and starts sending. Writes queued before loading finished
   * go after the saved ones, which are older. `legacy` are writes found in an older
   * storage format; they go first.
   */
  async load(legacy: OutboxRequest[] = []): Promise<void> {
    this.legacy.push(...legacy);
    if (this.loaded || this.reading) return;
    this.reading = true;
    let saved: PersistedOutbox | null;
    try {
      saved = parsePersistedOutbox(await this.deps.load());
    } catch {
      // The saved queue is there but can't be read right now (the storage key, say).
      // Keep it untouched: nothing is saved over it and nothing is sent ahead of it.
      // New writes wait in memory, and the next kick reads again.
      this.reading = false;
      this.unreadable = true;
      this.changed();
      return;
    }
    this.reading = false;
    this.unreadable = false;
    legacy = this.legacy;
    this.legacy = [];
    const restored = [...legacy.map((request) => this.entry(request)), ...(saved?.entries ?? [])];
    // Only the first write can have been on its way when the app stopped.
    if (restored[0]) restored[0].maybeDelivered = true;
    const queuedEarly = this.entries.length > 0;
    this.entries = [...(this.discardSaved ? [] : restored), ...this.entries];
    if (!this.discardSaved) this.parked = [...(saved?.stuck ?? []), ...this.parked];
    if (saved && !this.discardSaved && this.userId === null) this.userId = saved.userId;
    this.loaded = true;
    if (legacy.length || queuedEarly || this.discardSaved) this.persist();
    this.changed();
    this.kick();
  }

  /** Queues a write. The promise settles when the server accepts or refuses it. */
  enqueue(request: OutboxRequest): Promise<unknown> {
    const entry = this.entry(request);
    const done = new Promise<unknown>((resolve, reject) => {
      this.waiters.set(entry.id, { resolve, reject });
    });
    const head = this.parkedHeadFor(request);
    if (head) {
      // It names a record a stuck write creates or edits: sent now it would get 404.
      this.parked.push({ ...entry, stuckWith: head });
      this.settle(entry.id, undefined, new SetAsideError());
    } else this.entries.push(entry);
    this.persist();
    this.changed();
    this.kick();
    return done;
  }

  /**
   * Takes a queued write back before it goes out: it isn't being sent right now and
   * no earlier try can have reached the server. Returns whether it was taken back; if
   * not, it may land, and only another write can reverse it.
   */
  cancel(match: (request: OutboxRequest) => boolean): boolean {
    const unsent = (e: OutboxEntry) => e !== this.inFlight && !e.maybeDelivered && match(e.request);
    const entry = this.entries.find(unsent) ?? this.parked.find(unsent);
    if (!entry) return false;
    this.entries = this.entries.filter((e) => e !== entry);
    this.parked = this.parked.filter((e) => e !== entry);
    this.persist();
    this.changed();
    this.settle(entry.id, null);
    return true;
  }

  /** Records whose writes these are (the signed-in user). */
  setOwner(userId: string | null): void {
    if (this.userId === userId) return;
    this.userId = userId;
    this.persist();
  }

  /** Try now: the network came back, the app came forward, or the user signed in again. */
  kick(): void {
    if (!this.loaded) {
      if (this.unreadable) void this.load();
      return;
    }
    if (this.wake) {
      this.wake();
      return;
    }
    void this.run();
  }

  /** Drops every queued write (sign-out, account deleted, a different account signed in). */
  async clear(): Promise<void> {
    const dropped = this.entries;
    this.entries = [];
    this.parked = [];
    this.userId = null;
    if (!this.loaded) this.discardSaved = true;
    for (const entry of dropped) this.settle(entry.id, null);
    this.persist();
    this.changed();
    await this.saving;
  }

  /** Resolves once everything queued so far has been written to storage. */
  flushed(): Promise<void> {
    return this.saving;
  }

  private entry(request: OutboxRequest): OutboxEntry {
    return {
      id: (this.deps.newId ?? defaultId)(),
      request,
      queuedAt: (this.deps.now ?? Date.now)(),
      attempts: 0,
      maybeDelivered: false,
    };
  }

  private async run(): Promise<void> {
    if (this.running || !this.loaded) return;
    this.running = true;
    try {
      for (let entry = this.entries[0]; entry && this.deps.canSend(); entry = this.entries[0]) {
        let response: unknown;
        try {
          this.inFlight = entry;
          response = await this.deps.send(entry.request);
        } catch (error) {
          this.inFlight = null;
          if (this.entries[0] !== entry) continue; // cleared while sending
          const failure = this.deps.describe(error);
          const kind = classifyFailure(entry, failure);
          if (kind === "applied") {
            this.finish(entry, null);
          } else if (kind === "reject") {
            this.remove(entry);
            this.deps.onRejected?.(entry.request, error);
            this.settle(entry.id, undefined, error);
          } else if (kind === "retry") {
            entry.attempts += 1;
            entry.maybeDelivered ||= mayHaveReachedServer(failure);
            entry.serverFailures = isServerFault(failure) ? (entry.serverFailures ?? 0) + 1 : 0;
            if (entry.serverFailures >= STUCK_AFTER) {
              this.park(entry, error);
              continue;
            }
            this.persist();
            this.changed();
            await this.sleep((this.deps.delay ?? retryDelay)(entry.attempts));
          } else if (this.deps.canSend()) {
            // "session": canSend() turns false once the session is marked expired. If it
            // is still true the token was refreshed meanwhile; send again after a pause.
            entry.attempts += 1;
            await this.sleep((this.deps.delay ?? retryDelay)(entry.attempts));
          }
          continue;
        }
        this.inFlight = null;
        if (this.entries[0] !== entry) continue;
        this.finish(entry, response);
      }
    } finally {
      this.running = false;
    }
  }

  private finish(entry: OutboxEntry, response: unknown): void {
    this.entries = this.entries.filter((e) => e !== entry);
    followCreatedRecords(this.entries, response);
    this.persist();
    this.changed();
    this.deps.onSent?.(entry.request, response);
    this.settle(entry.id, response);
  }

  /**
   * Sets a write the server keeps failing on aside, so the ones behind it can go.
   * Every later write that names a record it creates or edits (or one of theirs) goes
   * aside with it, in order: sent first, it would get 404 and be lost, and Retry would
   * then bring the record back without it.
   */
  private park(entry: OutboxEntry, error: unknown): void {
    const ids = new Set(writtenIds(entry.request));
    const group: OutboxEntry[] = [entry];
    const rest: OutboxEntry[] = [];
    for (const later of this.entries) {
      if (later === entry) continue;
      if (mentionsAny(later.request, ids)) {
        group.push(later);
        for (const id of writtenIds(later.request)) ids.add(id);
      } else rest.push(later);
    }
    this.entries = rest;
    const key = groupKey(entry);
    this.parked = [...this.parked, ...group.map((e) => ({ ...e, stuckWith: key }))];
    this.persist();
    this.changed();
    this.deps.onStuck?.(entry.request, error);
    // Whoever waits on them hears now; a later retry from the list lands without them.
    for (const e of group) this.settle(e.id, undefined, error);
  }

  /** The stuck group a new write must join, because it names one of the group's records. */
  private parkedHeadFor(request: OutboxRequest): string | null {
    const groups = new Map<string, Set<string>>();
    for (const entry of this.parked) {
      const key = groupKey(entry);
      const ids = groups.get(key) ?? new Set<string>();
      for (const id of writtenIds(entry.request)) ids.add(id);
      groups.set(key, ids);
    }
    for (const [key, ids] of groups) if (mentionsAny(request, ids)) return key;
    return null;
  }

  private remove(entry: OutboxEntry): void {
    this.entries = this.entries.filter((e) => e !== entry);
    this.persist();
    this.changed();
  }

  private settle(id: string, value: unknown, error?: unknown): void {
    const waiter = this.waiters.get(id);
    if (!waiter) return;
    this.waiters.delete(id);
    if (error === undefined) waiter.resolve(value);
    else waiter.reject(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.wake = done;
    });
  }

  private persist(): void {
    // Until the saved queue has been read, writing would overwrite it.
    if (!this.loaded) return;
    const state: PersistedOutbox = {
      version: 1,
      userId: this.userId,
      entries: this.entries.map((entry) => ({ ...entry })),
      stuck: this.parked.map((entry) => ({ ...entry })),
    };
    this.saving = this.saving.then(() => this.deps.save(state)).catch(() => {});
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}
