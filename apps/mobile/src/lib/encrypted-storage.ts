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
  /** Throws KeyUnavailableError when the key can't be loaded right now. */
  decrypt(sealed: string): Promise<string>;
}

/**
 * The key store couldn't be read (a Keystore hiccup, or the phone still locked).
 * Nothing is wrong with the data: read again later.
 */
export class KeyUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The storage key can't be read right now", { cause });
    this.name = "KeyUnavailableError";
  }
}

/**
 * Loads a key once and shares it between callers. A failed load isn't kept: it
 * rejects with KeyUnavailableError and the next call loads again.
 */
export function retryingKey<K>(load: () => Promise<K>): () => Promise<K> {
  let key: Promise<K> | null = null;
  return () => {
    key ??= load().catch((error: unknown) => {
      key = null; // try again next time
      throw new KeyUnavailableError(error);
    });
    return key;
  };
}

/** Marks an encrypted value; anything else is plain text from before encryption. */
export const SEALED_PREFIX = "enc1:";
/** Where a value that no key can open is kept, instead of being deleted. */
export const UNREADABLE_SUFFIX = ".unreadable";

/** Bytes from base64 text (native AES takes bytes; it can't take the string). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** An encrypted storage, plus a way back for values that were moved aside. */
export interface EncryptedStorage extends KeyValueStorage {
  /**
   * Opens `${key}.unreadable` if the key can open it now, deletes that copy and
   * returns the value; null when there is none or it still can't be opened. Throws
   * KeyUnavailableError while the key can't be loaded.
   */
  recover(key: string): Promise<string | null>;
}

export interface EncryptedStorageEvents {
  /** A value was sealed with a key that is gone; it was moved to `${key}.unreadable`. */
  onUnreadable?(key: string): void;
  /** The cipher failed, so this value was stored as plain text rather than lost. */
  onPlainFallback?(key: string, error: unknown): void;
}

/**
 * Wraps `base` so values are sealed with `cipher`:
 * - a plain value written by an older build is still read; the next write seals it;
 * - when the key can't be loaded, reading throws KeyUnavailableError and the sealed
 *   value stays as it is, to be read on a later try;
 * - a value the key loaded but can't open (the key was replaced after a Keystore
 *   reset) reads as missing and is moved aside, never deleted;
 * - if the cipher can't work at all (no key could be stored), values are written
 *   plain and reported, so queued writes are never lost to an encryption failure.
 *   With `plainFallback: false` (data that can be fetched again, like the screen
 *   cache) the write is refused instead and the stored value is left as it was.
 */
export function createEncryptedStorage(
  base: KeyValueStorage,
  cipher: Cipher,
  events: EncryptedStorageEvents = {},
  { plainFallback = true }: { plainFallback?: boolean } = {},
): EncryptedStorage {
  return {
    async getItem(key) {
      const raw = await base.getItem(key);
      if (raw === null || !raw.startsWith(SEALED_PREFIX)) return raw;
      try {
        return await cipher.decrypt(raw.slice(SEALED_PREFIX.length));
      } catch (error) {
        if (error instanceof KeyUnavailableError) throw error;
        await base.setItem(key + UNREADABLE_SUFFIX, raw);
        await base.removeItem(key);
        events.onUnreadable?.(key);
        return null;
      }
    },
    async setItem(key, value) {
      let stored: string;
      try {
        stored = SEALED_PREFIX + (await cipher.encrypt(value));
      } catch (error) {
        if (!plainFallback) throw error;
        events.onPlainFallback?.(key, error);
        stored = value;
      }
      await base.setItem(key, stored);
    },
    removeItem: (key) => base.removeItem(key),
    async recover(key) {
      const raw = await base.getItem(key + UNREADABLE_SUFFIX);
      if (raw === null || !raw.startsWith(SEALED_PREFIX)) return null;
      try {
        const value = await cipher.decrypt(raw.slice(SEALED_PREFIX.length));
        await base.removeItem(key + UNREADABLE_SUFFIX);
        return value;
      } catch (error) {
        if (error instanceof KeyUnavailableError) throw error;
        return null;
      }
    },
  };
}
