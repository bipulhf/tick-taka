import { getRandomValues } from "expo-crypto";

// ULIDs are generated on the phone; Hermes has no Web Crypto, so expo-crypto fills in.
const globalWithCrypto = globalThis as { crypto?: { getRandomValues?: typeof getRandomValues } };
if (!globalWithCrypto.crypto?.getRandomValues) {
  globalWithCrypto.crypto = { ...(globalWithCrypto.crypto ?? {}), getRandomValues };
}
