import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { GOOGLE_WEB_CLIENT_ID } from "./config";
import { apiUrl, connectAuth, request } from "./http";
import { outbox } from "./outbox";
import {
  errorMessage,
  ISSUED_KEY,
  mustWipeBeforeSignIn,
  needsRefresh,
  PROFILE_KEY,
  type Profile,
  readStoredSession,
  type SessionResponse,
  sessionResponseSchema,
  TOKEN_KEY,
} from "./session";
import { createStore } from "./store";
import { clearUserData } from "./user-data";

export type { Profile } from "./session";

/** `undefined` while loading from secure storage, `null` when signed out or expired. */
export const tokenStore = createStore<string | null | undefined>(undefined);
/**
 * Who is signed in, for the account row in Settings. Kept when the session expires:
 * a profile with no token means "sign in again", and the phone's data waits for them.
 */
export const profileStore = createStore<Profile | null>(null);

/** When this phone got the current token; null when unknown (older builds). */
let issuedAt: number | null = null;

/** Reads the saved session. Always settles the token store, so start-up can't hang. */
export async function loadToken(): Promise<void> {
  const stored = await readStoredSession((key) => SecureStore.getItemAsync(key));
  if (stored.broken) {
    // Unreadable (Keystore reset or a restored backup): start again from the login screen.
    await Promise.all(
      [TOKEN_KEY, PROFILE_KEY, ISSUED_KEY].map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => {}),
      ),
    );
  }
  issuedAt = stored.issuedAt;
  if (stored.token && stored.profile) outbox.setOwner(stored.profile.id);
  profileStore.set(stored.profile);
  tokenStore.set(stored.token);
  if (stored.token) void refreshSessionIfStale();
}

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/** Thrown when the person closes Google's account picker; nothing to show for it. */
export class SignInCancelled extends Error {}

/** Google's own error codes, in words someone holding the phone can act on. */
function googleErrorMessage(error: unknown): string {
  if (!isErrorWithCode(error)) return (error as Error).message;
  switch (error.code) {
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "Google Play services is missing or out of date on this phone.";
    case statusCodes.IN_PROGRESS:
      return "Google sign-in is already open.";
    case "10": // DEVELOPER_ERROR: the app's signing key or client ID isn't registered.
      return "Google sign-in isn't set up for this build of the app yet.";
    case "7": // NETWORK_ERROR
      return "Couldn't reach Google. Check your connection.";
    default:
      return error.message || "Google sign-in didn't work. Try again.";
  }
}

/** Saves a new or refreshed session and lets queued writes go. */
async function saveSession(session: SessionResponse): Promise<void> {
  const now = Date.now();
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(session.user));
  await SecureStore.setItemAsync(ISSUED_KEY, String(now));
  issuedAt = now;
  outbox.setOwner(session.user.id);
  profileStore.set(session.user);
  tokenStore.set(session.token);
  outbox.kick();
}

/**
 * Native Google sign-in (Android's account picker, no browser), then trades the
 * Google ID token for our own session. A new Google account gets a fresh space.
 * Signing back in after a session expired keeps the phone's data and sends the
 * queued writes; a different account wipes the previous one's data first.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!GOOGLE_WEB_CLIENT_ID)
    throw new Error("Google sign-in isn't set up (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).");
  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new SignInCancelled();
    idToken = response.data.idToken;
  } catch (error) {
    if (error instanceof SignInCancelled) throw error;
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED)
      throw new SignInCancelled();
    throw new Error(googleErrorMessage(error));
  }
  if (!idToken) throw new Error("Google didn't return a sign-in token. Try again.");

  // A short timeout: an unreachable server should fail fast, not spin forever.
  const response = await request(apiUrl("/auth/google"), {
    method: "POST",
    json: { idToken },
    timeout: 15_000,
  });
  const body: unknown = await response.json().catch(() => null);
  const session = response.ok ? sessionResponseSchema.safeParse(body) : null;
  if (!session?.success) {
    // Let them pick a different account next time instead of reusing this one.
    await GoogleSignin.signOut().catch(() => {});
    throw new Error(errorMessage(body) ?? "Couldn't reach the server");
  }
  const previousUserId = profileStore.get()?.id ?? outbox.owner;
  if (mustWipeBeforeSignIn(previousUserId, session.data.user.id)) await clearUserData();
  await saveSession(session.data);
}

/**
 * A 401: the token expired or was revoked. Nothing is wiped. The token goes, the
 * profile and the queued writes stay, the outbox pauses (it needs a token) and the
 * login screen asks the same person to sign in again.
 */
export async function expireSession(): Promise<void> {
  if (!tokenStore.get()) return;
  tokenStore.set(null);
  issuedAt = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(ISSUED_KEY).catch(() => {});
}

let refreshing: Promise<void> | null = null;

/** Swaps a token older than a day for a fresh one, so an active phone never hits the expiry. */
export function refreshSessionIfStale(): Promise<void> {
  const token = tokenStore.get();
  if (!token || !needsRefresh(issuedAt, Date.now())) return Promise.resolve();
  refreshing ??= (async () => {
    try {
      const response = await request(apiUrl("/auth/refresh"), { method: "POST", timeout: 15_000 });
      // 401 is handled by the http hook (expireSession). A server without the route
      // answers 404: don't ask again until tomorrow.
      if (response.status === 404) issuedAt = Date.now();
      if (!response.ok) return;
      const session = sessionResponseSchema.safeParse(await response.json().catch(() => null));
      if (session.success && tokenStore.get() === token) await saveSession(session.data);
    } catch {
      // Offline or unreachable: try again on the next start or foreground.
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

AppState.addEventListener("change", (status) => {
  if (status === "active") void refreshSessionIfStale();
});

/** Wipes the session and everything of this user's from the phone, and signs out of Google. */
async function forgetUser(): Promise<void> {
  await Promise.all(
    [TOKEN_KEY, PROFILE_KEY, ISSUED_KEY].map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => {}),
    ),
  );
  issuedAt = null;
  tokenStore.set(null);
  profileStore.set(null);
  await Promise.all([GoogleSignin.signOut().catch(() => {}), clearUserData()]);
}

/**
 * Signs out of the app and Google, and wipes everything of this user's from the phone,
 * queued writes included: callers confirm first when any are waiting.
 */
export async function signOut(): Promise<void> {
  if (tokenStore.get()) {
    // Ends the session on the server too; best effort, it expires on its own anyway.
    await request(apiUrl("/auth/logout"), { method: "POST", timeout: 5_000 }).catch(() => {});
  }
  await forgetUser();
}

/**
 * Deletes the account and all its data on the server (DELETE /auth/account), then
 * wipes the phone. Throws with the server's message if the server didn't delete it;
 * the phone is left untouched in that case.
 */
export async function deleteAccount(): Promise<void> {
  const response = await request(apiUrl("/auth/account"), { method: "DELETE", timeout: 30_000 });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(body) ?? `Couldn't delete the account (${response.status})`);
  }
  await forgetUser();
}

connectAuth({ token: () => tokenStore.get(), onUnauthorized: () => void expireSession() });
