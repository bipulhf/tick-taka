import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";
import { createStore } from "./store";

const TOKEN_KEY = "tt.token";

/** `undefined` while loading from secure storage, `null` when signed out. */
export const tokenStore = createStore<string | null | undefined>(undefined);

export async function loadToken(): Promise<void> {
  tokenStore.set((await SecureStore.getItemAsync(TOKEN_KEY)) ?? null);
}

export async function signIn(password: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
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
