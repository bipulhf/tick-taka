/**
 * AsyncStorage-shaped storage that encrypts every value. Free of React Native, so it
 * can be tested with a fake cipher; the real one is AES-GCM (see secure-storage.ts).
 */

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface Cipher {
  encrypt(plain: string): Promise<string>;
  decrypt(sealed: string): Promise<string>;
}

/** Marks an encrypted value; anything else is plain text from before encryption. */
export const SEALED_PREFIX = "enc1:";

/**
 * Wraps `base` so values are sealed with `cipher`:
 * - a plain value written by an older build is still read, then sealed in place;
 * - a value that won't decrypt (the key was lost with a Keystore reset) reads as
 *   missing and is removed, rather than crashing start-up;
 * - if the cipher can't work at all (no key could be stored), values are written
 *   plain, so queued writes are never lost to an encryption failure.
 */
export function createEncryptedStorage(base: KeyValueStorage, cipher: Cipher): KeyValueStorage {
  return {
    async getItem(key) {
      const raw = await base.getItem(key);
      if (raw === null) return null;
      if (!raw.startsWith(SEALED_PREFIX)) {
        void cipher
          .encrypt(raw)
          .then((sealed) => base.setItem(key, SEALED_PREFIX + sealed))
          .catch(() => {});
        return raw;
      }
      try {
        return await cipher.decrypt(raw.slice(SEALED_PREFIX.length));
      } catch {
        await base.removeItem(key).catch(() => {});
        return null;
      }
    },
    async setItem(key, value) {
      let stored: string;
      try {
        stored = SEALED_PREFIX + (await cipher.encrypt(value));
      } catch {
        stored = value;
      }
      await base.setItem(key, stored);
    },
    removeItem: (key) => base.removeItem(key),
  };
}
