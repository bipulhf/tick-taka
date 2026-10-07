import AsyncStorage from "@react-native-async-storage/async-storage";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  base64ToBytes,
  type Cipher,
  createEncryptedStorage,
  retryingKey,
  utf8Decode,
} from "./encrypted-storage";
import { notify } from "./notify";

/** A random AES-256 key, created on first use and kept in the Android Keystore-backed store. */
const KEY_NAME = "tt.storage-key";

/** The storage key; rejects with KeyUnavailableError when the Keystore can't be read now. */
const storageKey = retryingKey(async (): Promise<AESEncryptionKey> => {
  const saved = await SecureStore.getItemAsync(KEY_NAME);
  if (saved) return AESEncryptionKey.import(saved, "hex");
  const created = await AESEncryptionKey.generate();
  await SecureStore.setItemAsync(KEY_NAME, await created.encoded("hex"));
  return created;
});

/** AES-GCM with a fresh nonce per value; the stored text is base64 of nonce + ciphertext + tag. */
const aesGcm: Cipher = {
  async encrypt(plain) {
    const sealed = await aesEncryptAsync(new TextEncoder().encode(plain), await storageKey());
    return sealed.combined("base64");
  },
  async decrypt(sealed) {
    // Android's fromCombined takes bytes only: handed the base64 string as is, it
    // throws, and every value read as "sealed with a lost key".
    const combined = AESSealedData.fromCombined(base64ToBytes(sealed));
    const bytes = await aesDecryptAsync(combined, await storageKey());
    // Hermes has no TextDecoder: calling it threw here, after a good decrypt.
    return utf8Decode(bytes);
  },
};

/**
 * Encrypted AsyncStorage for the user's data at rest: the query cache (balances,
 * transactions, notes), the outbox and the assistant chat. The app lock only hides
 * the screen; this keeps the data unreadable from a backup or a file dump (and
 * android.allowBackup is off).
 *
 * The one exception is the home-screen widget's small store (features/widget/
 * widget-cache.ts: today's left-to-spend, the next task's title, and expenses tapped
 * on the widget while offline until the app opens). Android renders the widget from
 * a headless task that may run before the Keystore is unlocked after a reboot, and a
 * widget that can't read its numbers or save a tap would lose the expense; it is
 * shown on the home screen anyway, so it stays in plain AsyncStorage.
 */
export const secureStorage = createEncryptedStorage(AsyncStorage, aesGcm, {
  onUnreadable(name, error) {
    console.warn(`Stored ${name} couldn't be opened; kept aside as unreadable`, error);
    if (name === "tt.outbox")
      notify("Some changes saved on this phone can't be read anymore and weren't synced.");
  },
  onPlainFallback(name, error) {
    console.warn(`Couldn't encrypt ${name}; stored without encryption`, error);
  },
});

/**
 * The same, for the screen cache: it can always be fetched again, so when the key
 * can't seal it, it isn't saved at all rather than saved in plain text.
 */
export const secureCacheStorage = createEncryptedStorage(
  AsyncStorage,
  aesGcm,
  {
    onUnreadable(name, error) {
      console.warn(`Stored ${name} couldn't be opened; kept aside as unreadable`, error);
    },
  },
  { plainFallback: false },
);
