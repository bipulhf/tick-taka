import * as SecureStore from "expo-secure-store";
import { apiUrl, connectAuth, request } from "./http";
import { createStore } from "./store";

const TOKEN_KEY = "tt.token";

/** `undefined` while loading from secure storage, `null` when signed out. */
export const tokenStore = createStore<string | null | undefined>(undefined);

export async function loadToken(): Promise<void> {
  tokenStore.set((await SecureStore.getItemAsync(TOKEN_KEY)) ?? null);
}

export async function signIn(password: string): Promise<void> {
  // A short timeout: an unreachable server should fail fast, not spin forever.
  const response = await request(apiUrl("/auth/login"), {
    method: "POST",
    json: { password },
    timeout: 15_000,
  });
  const body = (await response.json().catch(() => null)) as {
    token?: string;
    error?: { message: string };
  } | null;
  if (!response.ok || !body?.token)
    throw new Error(body?.error?.message ?? "Couldn't reach the server");
  await SecureStore.setItemAsync(TOKEN_KEY, body.token);
  tokenStore.set(body.token);
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  tokenStore.set(null);
}

connectAuth({ token: () => tokenStore.get(), onUnauthorized: () => void signOut() });
