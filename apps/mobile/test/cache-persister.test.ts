import { describe, expect, test } from "bun:test";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
  type PersistedClient,
  persistQueryClientRestore,
} from "@tanstack/react-query-persist-client";
import { keepCacheOnKeyFailure } from "../src/lib/cache-persister";
import {
  type Cipher,
  createEncryptedStorage,
  KeyUnavailableError,
  SEALED_PREFIX,
} from "../src/lib/encrypted-storage";

const KEY = "tt.query-cache";

/** A cipher whose key can be made unreadable, as after a Keystore hiccup at start. */
function lockableCipher() {
  const state = { locked: false };
  const cipher: Cipher = {
    encrypt: async (plain) => {
      if (state.locked) throw new KeyUnavailableError();
      return btoa(encodeURIComponent(plain));
    },
    decrypt: async (sealed) => {
      if (state.locked) throw new KeyUnavailableError();
      return decodeURIComponent(atob(sealed));
    },
  };
  return { cipher, state };
}

function disk() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

const cached = (balance: number): PersistedClient => ({
  timestamp: Date.now(),
  buster: "3",
  clientState: {
    mutations: [],
    queries: [
      {
        queryKey: ["accounts"],
        queryHash: '["accounts"]',
        dehydratedAt: Date.now(),
        state: {
          data: [{ id: "a1", balanceMinor: balance }],
          dataUpdateCount: 1,
          dataUpdatedAt: Date.now() - 1000,
          error: null,
          errorUpdateCount: 0,
          errorUpdatedAt: 0,
          fetchFailureReason: null,
          fetchFailureCount: 0,
          fetchMeta: null,
          isInvalidated: false,
          status: "success",
          fetchStatus: "idle",
        },
      },
    ],
  },
});

function setup() {
  const base = disk();
  const { cipher, state } = lockableCipher();
  const storage = createEncryptedStorage(base, cipher, {}, { plainFallback: false });
  const inner = createAsyncStoragePersister({ storage, key: KEY, throttleTime: 0 });
  const late: PersistedClient[] = [];
  let clock = 0;
  const persister = keepCacheOnKeyFailure(
    inner,
    (client) => late.push(client),
    () => clock,
  );
  return {
    base,
    state,
    storage,
    persister,
    late,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("the screen cache when the storage key can't be read at start (QA-305, CQ-037)", () => {
  test("restore skips the cache instead of deleting it", async () => {
    const { base, state, storage, persister } = setup();
    await storage.setItem(KEY, JSON.stringify(cached(5000)));
    const sealed = base.data.get(KEY);
    expect(sealed?.startsWith(SEALED_PREFIX)).toBe(true);

    state.locked = true;
    const queryClient = new QueryClient();
    await persistQueryClientRestore({ queryClient, persister, buster: "3" });
    expect(queryClient.getQueryData(["accounts"])).toBeUndefined();
    expect(base.data.get(KEY)).toBe(sealed);
  });

  test("nothing is saved over it, and never in plain text, until the key reads again", async () => {
    const { base, state, storage, persister, late, advance } = setup();
    await storage.setItem(KEY, JSON.stringify(cached(5000)));
    const sealed = base.data.get(KEY);
    state.locked = true;
    expect(await persister.restoreClient()).toBeUndefined();

    // The empty start-up cache wants saving: it must not replace the kept one.
    await persister.persistClient(cached(0));
    advance(10_000);
    await persister.persistClient(cached(0));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(base.data.get(KEY)).toBe(sealed);
    expect(late).toEqual([]);

    // The key is back: the kept cache is read first, then saving resumes.
    state.locked = false;
    advance(10_000);
    await persister.persistClient(cached(0));
    expect(late).toHaveLength(1);
    expect(late[0]?.clientState.queries[0]?.state.data).toEqual([{ id: "a1", balanceMinor: 5000 }]);
    await persister.persistClient(cached(7000));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(base.data.get(KEY)?.startsWith(SEALED_PREFIX)).toBe(true);
    expect(JSON.parse((await storage.getItem(KEY)) ?? "null")).toMatchObject({
      clientState: { queries: [{ state: { data: [{ balanceMinor: 7000 }] } }] },
    });
  });

  test("a cache storage without the plain fallback refuses to write when it can't seal", async () => {
    const { base, state, storage } = setup();
    state.locked = true;
    await expect(storage.setItem(KEY, "secret")).rejects.toBeInstanceOf(KeyUnavailableError);
    expect(base.data.has(KEY)).toBe(false);
  });
});
