import AsyncStorage from "@react-native-async-storage/async-storage";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { type Cipher, createEncryptedStorage } from "./encrypted-storage";

/** A random AES-256 key, created on first use and kept in the Android Keystore-backed store. */
const KEY_NAME = "tt.storage-key";

let key: Promise<AESEncryptionKey> | null = null;

function storageKey(): Promise<AESEncryptionKey> {
  key ??= (async () => {
    const saved = await SecureStore.getItemAsync(KEY_NAME);
    if (saved) return AESEncryptionKey.import(saved, "hex");
    const created = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(KEY_NAME, await created.encoded("hex"));
    return created;
  })().catch((error: unknown) => {
    key = null; // try again next time
    throw error;
  });
  return key;
}

/** AES-GCM with a fresh nonce per value; the stored text is base64 of nonce + ciphertext + tag. */
const aesGcm: Cipher = {
  async encrypt(plain) {
    const sealed = await aesEncryptAsync(new TextEncoder().encode(plain), await storageKey());
    return sealed.combined("base64");
  },
  async decrypt(sealed) {
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(sealed), await storageKey());
    return new TextDecoder().decode(bytes);
  },
};

/**
 * Encrypted AsyncStorage for the user's data at rest: the query cache (balances,
 * transactions, notes), the outbox and the assistant chat. The app lock only hides
 * the screen; this keeps the data unreadable from a backup or a file dump.
 */
export const secureStorage = createEncryptedStorage(AsyncStorage, aesGcm);
