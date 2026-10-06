import {
  classifyFailure,
  type FailureInfo,
  followCreatedRecords,
  mayHaveReachedServer,
  type OutboxEntry,
  type OutboxRequest,
  type PersistedOutbox,
  parsePersistedOutbox,
  retryDelay,
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

/**
 * Every write goes through one queue, sent one at a time in the order made. An entry
 * stays saved until the server has it, so a write that is sending when the app is
 * killed is sent again on the next start. Unreachable servers, 5xx and 429 retry
 * forever with a capped backoff; a 401 pauses the queue without dropping anything;
 * only a final 4xx takes a write out.
 */
export class OutboxQueue {
  private entries: OutboxEntry[] = [];
  private userId: string | null = null;
  private loaded = false;
  /** Cleared before the saved queue was read: what's on disk is not to be sent. */
  private discardSaved = false;
  private running = false;
  private wake: (() => void) | null = null;
  private saving: Promise<void> = Promise.resolve();
  private readonly waiters = new Map<string, Waiter>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: OutboxDeps) {}

  /** Number of writes not yet on the server. */
  get size(): number {
    return this.entries.length;
  }

  get owner(): string | null {
    return this.userId;
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
    let saved: PersistedOutbox | null = null;
    try {
      saved = parsePersistedOutbox(await this.deps.load());
    } catch {
      saved = null;
    }
    const restored = [...legacy.map((request) => this.entry(request)), ...(saved?.entries ?? [])];
    // Only the first write can have been on its way when the app stopped.
    if (restored[0]) restored[0].maybeDelivered = true;
    const queuedEarly = this.entries.length > 0;
    this.entries = [...(this.discardSaved ? [] : restored), ...this.entries];
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
    this.entries.push(entry);
    this.persist();
    this.changed();
    this.kick();
    return done;
  }

  /** Records whose writes these are (the signed-in user). */
  setOwner(userId: string | null): void {
    if (this.userId === userId) return;
    this.userId = userId;
    this.persist();
  }

  /** Try now: the network came back, the app came forward, or the user signed in again. */
  kick(): void {
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
      while (this.entries.length > 0 && this.deps.canSend()) {
        const entry = this.entries[0]!;
        let response: unknown;
        try {
          response = await this.deps.send(entry.request);
        } catch (error) {
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
    };
    this.saving = this.saving.then(() => this.deps.save(state)).catch(() => {});
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}
