import { describe, expect, test } from "bun:test";
import {
  type Cipher,
  createEncryptedStorage,
  type KeyValueStorage,
  SEALED_PREFIX,
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

  test("plain data from before encryption is read once, then sealed in place", async () => {
    const base = memory();
    base.data.set("tt.outbox", '{"version":1}');
    const storage = createEncryptedStorage(base, fake);
    expect(await storage.getItem("tt.outbox")).toBe('{"version":1}');
    await settle();
    expect(base.data.get("tt.outbox")!.startsWith(SEALED_PREFIX)).toBe(true);
    expect(await storage.getItem("tt.outbox")).toBe('{"version":1}');
  });

  test("a value whose key is gone reads as missing instead of crashing", async () => {
    const base = memory();
    await createEncryptedStorage(base, fake).setItem("k", "secret");
    expect(await createEncryptedStorage(base, broken).getItem("k")).toBeNull();
    expect(base.data.has("k")).toBe(false);
  });

  test("with no working cipher, writes still land rather than being lost", async () => {
    const base = memory();
    await createEncryptedStorage(base, broken).setItem("tt.outbox", "queued");
    expect(base.data.get("tt.outbox")).toBe("queued");
  });
});
