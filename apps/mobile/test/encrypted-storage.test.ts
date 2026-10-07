import { describe, expect, test } from "bun:test";
import {
  type Cipher,
  createEncryptedStorage,
  KeyUnavailableError,
  type KeyValueStorage,
  retryingKey,
  SEALED_PREFIX,
  UNREADABLE_SUFFIX,
} from "../src/lib/encrypted-storage";

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

/** Reversible stand-in for AES: what matters here is that nothing is stored as written. */
const fake: Cipher = {
  encrypt: async (plain) => btoa(encodeURIComponent(plain)).split("").reverse().join(""),
  decrypt: async (sealed) => decodeURIComponent(atob(sealed.split("").reverse().join(""))),
};
const broken: Cipher = {
  encrypt: async () => {
    throw new Error("no key");
  },
  decrypt: async () => {
    throw new Error("no key");
  },
};
const settle = () => new Promise((r) => setTimeout(r, 5));

describe("encrypted storage", () => {
  test("values round-trip and are never stored as written", async () => {
    const base = memory();
    const storage = createEncryptedStorage(base, fake);
    const value = JSON.stringify({ note: "salary ৳85,000", balance: 120_000 });
    await storage.setItem("tt.query-cache", value);
    const raw = base.data.get("tt.query-cache")!;
    expect(raw.startsWith(SEALED_PREFIX)).toBe(true);
    expect(raw).not.toContain("salary");
    expect(await storage.getItem("tt.query-cache")).toBe(value);
  });

  test("plain data from before encryption is read, and sealed by the next write", async () => {
    const base = memory();
    base.data.set("tt.outbox", '{"version":1}');
    const storage = createEncryptedStorage(base, fake);
    expect(await storage.getItem("tt.outbox")).toBe('{"version":1}');
    await settle();
    // No background re-seal that could land over a newer write.
    expect(base.data.get("tt.outbox")).toBe('{"version":1}');
    await storage.setItem("tt.outbox", '{"version":1,"n":2}');
    expect(base.data.get("tt.outbox")!.startsWith(SEALED_PREFIX)).toBe(true);
    expect(await storage.getItem("tt.outbox")).toBe('{"version":1,"n":2}');
  });

  test("a value whose key was replaced reads as missing and is kept aside, not deleted", async () => {
    const base = memory();
    await createEncryptedStorage(base, fake).setItem("k", "secret");
    const sealed = base.data.get("k");
    const unreadable: string[] = [];
    const storage = createEncryptedStorage(base, broken, {
      onUnreadable: (k) => unreadable.push(k),
    });
    expect(await storage.getItem("k")).toBeNull();
    expect(base.data.has("k")).toBe(false);
    expect(base.data.get(`k${UNREADABLE_SUFFIX}`)).toBe(sealed);
    expect(unreadable).toEqual(["k"]);
  });

  test("when the key can't be loaded, reading throws and the value stays for a later try", async () => {
    const base = memory();
    await createEncryptedStorage(base, fake).setItem("tt.outbox", "queued");
    const sealed = base.data.get("tt.outbox");
    let keyReads = 0;
    const flaky: Cipher = {
      encrypt: fake.encrypt,
      decrypt: async (value) => {
        if (keyReads++ === 0) throw new KeyUnavailableError(new Error("Keystore busy"));
        return fake.decrypt(value);
      },
    };
    const storage = createEncryptedStorage(base, flaky);
    await expect(storage.getItem("tt.outbox")).rejects.toBeInstanceOf(KeyUnavailableError);
    expect(base.data.get("tt.outbox")).toBe(sealed);
    expect(await storage.getItem("tt.outbox")).toBe("queued");
  });

  test("with no working cipher, writes still land and the fallback is reported", async () => {
    const base = memory();
    const plain: string[] = [];
    await createEncryptedStorage(base, broken, {
      onPlainFallback: (key) => plain.push(key),
    }).setItem("tt.outbox", "queued");
    expect(base.data.get("tt.outbox")).toBe("queued");
    expect(plain).toEqual(["tt.outbox"]);
  });
});

// QA-406: the storage key after a Keystore hiccup.
describe("loading the storage key", () => {
  test("a failed load says the key is unavailable, and the next call loads again", async () => {
    let loads = 0;
    let keystoreUp = false;
    const storageKey = retryingKey(async () => {
      loads++;
      if (!keystoreUp) throw new Error("Keystore locked");
      return "key";
    });
    await expect(storageKey()).rejects.toBeInstanceOf(KeyUnavailableError);
    keystoreUp = true;
    expect(await storageKey()).toBe("key");
    expect(loads).toBe(2);
  });

  test("once loaded, the key is shared and not loaded again", async () => {
    let loads = 0;
    const storageKey = retryingKey(async () => {
      loads++;
      return "key";
    });
    expect(await Promise.all([storageKey(), storageKey()])).toEqual(["key", "key"]);
    expect(await storageKey()).toBe("key");
    expect(loads).toBe(1);
  });
});
