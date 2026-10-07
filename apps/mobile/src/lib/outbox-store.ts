import { type OutboxEntry, type PersistedOutbox, parsePersistedOutbox } from "./outbox-policy";

/** Where the outbox keeps its queue between runs. */
export interface OutboxStorage {
  load(): Promise<unknown>;
  save(state: PersistedOutbox): Promise<void>;
  /**
   * A side key for writes queued before the saved queue has been read: saving them
   * there can't overwrite it. load() merges them in. Without these, such writes are
   * held in memory only.
   */
  loadEarly?(): Promise<unknown>;
  saveEarly?(state: PersistedOutbox): Promise<void>;
  /** Saving the queue failed (after working, or for the first time). */
  onSaveFailed?(error: unknown): void;
}

/**
 * The outbox queue's saves, in order: the saved queue once it has been read, the side
 * key before then. A failed save is reported once and shows (notSaved) until a save
 * works again. The queue decides what to save; this decides where and in what order.
 */
export class OutboxStore {
  private saving: Promise<void> = Promise.resolve();
  private saveFailed = false;
  /** Read once from the side key (loadEarly); emptied when load() merges it. */
  private earlier: Promise<OutboxEntry[] | null> | null = null;

  constructor(
    private readonly storage: OutboxStorage,
    /** Something listeners show changed (notSaved). */
    private readonly changed: () => void,
  ) {}

  /** The saved queue and the writes on the side key; throws while either can't be read. */
  async read(): Promise<{ saved: PersistedOutbox | null; earlier: OutboxEntry[] }> {
    const saved = parsePersistedOutbox(await this.storage.load());
    const earlier = await this.readEarlier();
    if (earlier === null) throw new Error("writes saved before loading can't be read");
    return { saved, earlier };
  }

  /** load() has merged the side key's writes into the queue: none are left to read. */
  merged(): void {
    this.earlier = Promise.resolve([]);
  }

  /** Saves the queue, once it has been read. */
  save(state: PersistedOutbox): void {
    this.queueSave(() => this.storage.save(state));
  }

  /**
   * Until the saved queue has been read, writing it would overwrite it: these writes
   * go to the side key instead, after any an earlier run left there.
   */
  saveEarly(
    entries: OutboxEntry[],
    cleared: boolean,
    state: (entries: OutboxEntry[]) => PersistedOutbox,
  ): void {
    const saveEarly = this.storage.saveEarly;
    if (!saveEarly) return;
    this.queueSave(async () => {
      const earlier = cleared ? [] : await this.readEarlier();
      if (earlier === null)
        throw new Error("Writes saved earlier can't be read, so not saved over");
      const ids = new Set(entries.map((e) => e.id));
      await saveEarly(state([...earlier.filter((e) => !ids.has(e.id)), ...entries]));
    });
  }

  /** The side key is emptied only once the queue holding its writes is safely saved. */
  emptyEarly(state: () => PersistedOutbox): void {
    const saveEarly = this.storage.saveEarly;
    if (!saveEarly) return;
    this.queueSave(async () => {
      if (!this.saveFailed) await saveEarly(state());
    });
  }

  /** Resolves once everything queued so far has been written to storage. */
  flushed(): Promise<void> {
    return this.saving;
  }

  /** The last save didn't work: what's queued lives only in memory until one does. */
  get notSaved(): boolean {
    return this.saveFailed;
  }

  /** Waits for every save queued so far, including ones queued meanwhile; true if none failed. */
  async drained(): Promise<boolean> {
    for (let current = this.saving; ; current = this.saving) {
      await current;
      if (current === this.saving) break;
    }
    return !this.saveFailed;
  }

  /** Writes left on the side key by an earlier run; null while they can't be read. */
  private readEarlier(): Promise<OutboxEntry[] | null> {
    const loadEarly = this.storage.loadEarly;
    if (!loadEarly) return Promise.resolve([]);
    this.earlier ??= loadEarly().then(
      (raw) => parsePersistedOutbox(raw)?.entries ?? [],
      () => {
        this.earlier = null; // read again next time
        return null;
      },
    );
    return this.earlier;
  }

  /** Saves in order; a failure is reported once, and shows until a save works again. */
  private queueSave(write: () => Promise<void>): void {
    this.saving = this.saving.then(write).then(
      () => {
        if (!this.saveFailed) return;
        this.saveFailed = false;
        this.changed();
      },
      (error: unknown) => {
        if (this.saveFailed) return;
        this.saveFailed = true;
        this.storage.onSaveFailed?.(error);
        this.changed();
      },
    );
  }
}
