import {
  ISSUED_KEY,
  needsRefresh,
  PROFILE_KEY,
  type Profile,
  readStoredSession,
  type SessionResponse,
  sessionResponseSchema,
  TOKEN_KEY,
} from "./session";
import { createStore } from "./store";

/** The bits of SecureStore the session needs, so tests can hand in a fake. */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface SessionDeps {
  storage: SessionStorage;
  /** POST /auth/refresh with the current token; may throw when the server is unreachable. */
  postRefresh(): Promise<Response>;
  outbox: { setOwner(userId: string): void; kick(): void };
  now(): number;
  /** Writing a new session to storage failed, even on a retry; it stays in memory. */
  onSaveFailed?(error: unknown): void;
}

/**
 * The signed-in session and its lifecycle: load at start, save after sign-in or
 * refresh, expire on a 401, forget on sign-out. React Native stays outside (see
 * auth.ts), so the ordering rules here can be tested.
 */
export function createSessionManager(deps: SessionDeps) {
  /** `undefined` while loading from secure storage, `null` when signed out or expired. */
  const tokenStore = createStore<string | null | undefined>(undefined);
  /** Kept when the session expires: a profile with no token means "sign in again". */
  const profileStore = createStore<Profile | null>(null);
  /** When this phone got the current token; null when unknown (older builds). */
  let issuedAt: number | null = null;
  /** The refresh in flight, and the token it is replacing. */
  let refreshing: { token: string; done: Promise<void> } | null = null;
  /** A session in use whose keys couldn't be written yet; written again on the next try. */
  let unsaved: { session: SessionResponse; at: number } | null = null;

  const removeKeys = (keys: string[]) =>
    Promise.all(keys.map((key) => deps.storage.deleteItem(key).catch(() => {})));

  /** Reads the saved session. Always settles the token store, so start-up can't hang. */
  async function load(): Promise<void> {
    const stored = await readStoredSession((key) => deps.storage.getItem(key));
    // Unreadable (Keystore reset or a restored backup): start again from the login screen.
    if (stored.broken) await removeKeys([TOKEN_KEY, PROFILE_KEY, ISSUED_KEY]);
    issuedAt = stored.issuedAt;
    if (stored.token && stored.profile) deps.outbox.setOwner(stored.profile.id);
    profileStore.set(stored.profile);
    tokenStore.set(stored.token);
    if (!stored.token) return;
    // The saved queue may have loaded before the token did, and found it couldn't send.
    deps.outbox.kick();
    void refreshIfStale();
  }

  /**
   * Switches to a new or refreshed session and lets queued writes go. The token
   * changes in memory first: a 401 for the old token that arrives while the keys
   * are being written is then recognised as stale and ignored.
   */
  async function save(session: SessionResponse): Promise<void> {
    const at = deps.now();
    issuedAt = at;
    deps.outbox.setOwner(session.user.id);
    profileStore.set(session.user);
    tokenStore.set(session.token);
    deps.outbox.kick();
    unsaved = { session, at };
    await writeUnsaved();
  }

  /**
   * Writes the session in use to storage, retrying once at once. If that fails too it
   * stays in memory, is reported, and is written again on the next refreshIfStale
   * (start or foreground): once the new token is used the server retires the old one,
   * so a cold start with the old one on disk would have to sign in again. Throws only
   * when the write failed.
   */
  async function writeUnsaved(): Promise<void> {
    const pending = unsaved;
    if (!pending) return;
    const { session, at } = pending;
    const write = async () => {
      await deps.storage.setItem(TOKEN_KEY, session.token);
      await deps.storage.setItem(PROFILE_KEY, JSON.stringify(session.user));
      await deps.storage.setItem(ISSUED_KEY, String(at));
    };
    try {
      await write().catch(write);
    } catch (error) {
      deps.onSaveFailed?.(error);
      throw error;
    }
    if (unsaved === pending) unsaved = null;
  }

  /**
   * A 401: the token expired or was revoked. Nothing is wiped. The token goes, the
   * profile and the queued writes stay, the outbox pauses (it needs a token) and the
   * login screen asks the same person to sign in again.
   */
  async function expire(): Promise<void> {
    if (!tokenStore.get()) return;
    tokenStore.set(null);
    issuedAt = null;
    unsaved = null;
    await removeKeys([TOKEN_KEY, ISSUED_KEY]);
  }

  /**
   * The server refused `sentToken`. Only the token in use now can expire the
   * session: a 401 for one that was replaced says nothing about the new one. While
   * that token is being refreshed, wait: if the refresh lands, the 401 was stale.
   */
  function onUnauthorized(sentToken: string | null): void {
    const current = tokenStore.get();
    if (!current || sentToken !== current) return;
    if (refreshing?.token === current) {
      void refreshing.done.then(() => {
        if (tokenStore.get() === current) void expire();
      });
      return;
    }
    void expire();
  }

  /** Swaps a token older than a day for a fresh one, so an active phone never hits the expiry. */
  function refreshIfStale(): Promise<void> {
    const token = tokenStore.get();
    // The token in use never reached the disk: write it, rather than fetch another.
    if (token && unsaved?.session.token === token) return writeUnsaved().catch(() => {});
    if (!token || !needsRefresh(issuedAt, deps.now())) return Promise.resolve();
    if (refreshing) return refreshing.done;
    const done = (async () => {
      try {
        const response = await deps.postRefresh();
        // A server without the route answers 404: don't ask again until tomorrow.
        if (response.status === 404) issuedAt = deps.now();
        // 401 reaches onUnauthorized through the http hook, which waits for this.
        if (!response.ok) return;
        const session = sessionResponseSchema.safeParse(await response.json().catch(() => null));
        // Signed out or into another account meanwhile: the reply is for nobody.
        if (session.success && tokenStore.get() === token) await save(session.data);
      } catch {
        // Offline or unreachable: try again on the next start or foreground.
      } finally {
        refreshing = null;
      }
    })();
    refreshing = { token, done };
    return done;
  }

  /** Forgets the session on this phone: keys, token and profile. */
  async function forget(): Promise<void> {
    unsaved = null;
    await removeKeys([TOKEN_KEY, PROFILE_KEY, ISSUED_KEY]);
    issuedAt = null;
    tokenStore.set(null);
    profileStore.set(null);
  }

  return { tokenStore, profileStore, load, save, expire, onUnauthorized, refreshIfStale, forget };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
