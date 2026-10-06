import { describe, expect, test } from "bun:test";
import { ISSUED_KEY, PROFILE_KEY, REFRESH_AFTER_MS, TOKEN_KEY } from "../src/lib/session";
import { createSessionManager } from "../src/lib/session-manager";

const NOW = Date.UTC(2026, 9, 7, 8);
const profile = { id: "user-1", email: "a@example.com", name: "A", pictureUrl: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const refreshReply = (token: string) =>
  new Response(JSON.stringify({ token, expiresAt: NOW + 30 * 86_400_000, user: profile }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/** A session that was saved a day and a bit ago, so loading it starts a refresh. */
function setup(options: { issuedAt?: number; slowWrites?: boolean } = {}) {
  const saved = new Map<string, string>([
    [TOKEN_KEY, "old"],
    [PROFILE_KEY, JSON.stringify(profile)],
    [ISSUED_KEY, String(options.issuedAt ?? NOW - REFRESH_AFTER_MS - 1)],
  ]);
  const writes = deferred<void>();
  const refresh = deferred<Response>();
  const outbox = { owner: null as string | null, kicks: 0 };
  const manager = createSessionManager({
    storage: {
      getItem: async (key) => saved.get(key) ?? null,
      setItem: async (key, value) => {
        if (options.slowWrites) await writes.promise;
        saved.set(key, value);
      },
      deleteItem: async (key) => {
        saved.delete(key);
      },
    },
    postRefresh: () => refresh.promise,
    outbox: {
      setOwner: (id) => {
        outbox.owner = id;
      },
      kick: () => {
        outbox.kicks++;
      },
    },
    now: () => NOW,
  });
  return { manager, saved, refresh, writes, outbox };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("session lifecycle", () => {
  test("loading a saved token lets the queue send at once", async () => {
    const { manager, outbox } = setup({ issuedAt: NOW - 1000 });
    await manager.load();
    expect(manager.tokenStore.get()).toBe("old");
    expect(outbox.owner).toBe("user-1");
    expect(outbox.kicks).toBe(1);
  });

  test("a 401 for the current token expires the session but keeps the profile", async () => {
    const { manager, saved } = setup({ issuedAt: NOW - 1000 });
    await manager.load();
    manager.onUnauthorized("old");
    await flush();
    expect(manager.tokenStore.get()).toBeNull();
    expect(manager.profileStore.get()).toEqual(profile);
    expect(saved.has(TOKEN_KEY)).toBe(false);
    expect(saved.has(PROFILE_KEY)).toBe(true);
  });

  test("a 401 for a token that was already replaced is ignored", async () => {
    const { manager } = setup({ issuedAt: NOW - 1000 });
    await manager.load();
    manager.onUnauthorized("older-still");
    await flush();
    expect(manager.tokenStore.get()).toBe("old");
  });
});

describe("a 401 that races the daily refresh", () => {
  test("given a refresh is in flight, a 401 for the old token doesn't sign the phone out", async () => {
    const { manager, refresh, saved } = setup();
    await manager.load(); // starts the refresh
    manager.onUnauthorized("old"); // a GET sent with the old token comes back 401
    await flush();
    expect(manager.tokenStore.get()).toBe("old");
    refresh.resolve(refreshReply("new"));
    await manager.refreshIfStale();
    await flush();
    expect(manager.tokenStore.get()).toBe("new");
    expect(saved.get(TOKEN_KEY)).toBe("new");
  });

  test("the new token is in use before the keys are written", async () => {
    const { manager, refresh, writes, saved } = setup({ slowWrites: true });
    await manager.load();
    refresh.resolve(refreshReply("new"));
    await flush();
    await flush();
    expect(manager.tokenStore.get()).toBe("new");
    // A 401 for the old token while the Keystore writes are pending is stale.
    manager.onUnauthorized("old");
    writes.resolve();
    await flush();
    expect(manager.tokenStore.get()).toBe("new");
    expect(saved.get(TOKEN_KEY)).toBe("new");
  });

  test("if the refresh is refused too, the session does expire", async () => {
    const { manager, refresh } = setup();
    await manager.load();
    manager.onUnauthorized("old");
    refresh.resolve(new Response(null, { status: 401 }));
    await flush();
    await flush();
    expect(manager.tokenStore.get()).toBeNull();
  });

  test("an unreachable server keeps the old token for the next try", async () => {
    const { manager, refresh } = setup();
    await manager.load();
    refresh.resolve(Promise.reject(new Error("offline")) as never);
    await flush();
    expect(manager.tokenStore.get()).toBe("old");
  });
});
