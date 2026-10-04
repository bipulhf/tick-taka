import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";
import { createStore } from "./store";

const TOKEN_KEY = "tt.token";

/** `undefined` while loading from secure storage, `null` when signed out. */
export const tokenStore = createStore<string | null | undefined>(undefined);

export async function loadToken(): Promise<void> {
  tokenStore.set((await SecureStore.getItemAsync(TOKEN_KEY)) ?? null);
}

const SIGN_IN_TIMEOUT_MS = 15_000;

export async function signIn(password: string): Promise<void> {
  // Without a timeout an unreachable server leaves the button spinning forever.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SIGN_IN_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
      signal: abort.signal,
    });
  } catch {
    throw new Error(
      `Can't reach the server at ${API_URL}. Check that it's running and the phone is on the same Wi-Fi.`,
    );
  } finally {
    clearTimeout(timer);
  }
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
