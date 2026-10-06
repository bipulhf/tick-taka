import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { apiErrorFrom } from "./api";
import { GOOGLE_WEB_CLIENT_ID } from "./config";
import { apiUrl, connectAuth, request } from "./http";
import { outbox } from "./outbox";
import { mustWipeBeforeSignIn, sessionResponseSchema } from "./session";
import { createSessionManager } from "./session-manager";
import { createStore } from "./store";
import { clearUserData } from "./user-data";

export type { Profile } from "./session";

const sessionManager = createSessionManager({
  storage: {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  },
  postRefresh: () => request(apiUrl("/auth/refresh"), { method: "POST", timeout: 15_000 }),
  outbox,
  now: Date.now,
});

/** `undefined` while loading from secure storage, `null` when signed out or expired. */
export const tokenStore = sessionManager.tokenStore;
/**
 * Who is signed in, for the account row in Settings. Kept when the session expires:
 * a profile with no token means "sign in again", and the phone's data waits for them.
 */
export const profileStore = sessionManager.profileStore;

/** Reads the saved session. Always settles the token store, so start-up can't hang. */
export const loadToken = sessionManager.load;

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
    // An ApiError, so the login screen words it through lib/error-copy.ts.
    throw apiErrorFrom(response.ok ? 502 : response.status, body);
  }
  const previousUserId = profileStore.get()?.id ?? outbox.owner;
  if (mustWipeBeforeSignIn(previousUserId, session.data.user.id)) await clearUserData();
  await sessionManager.save(session.data);
  signedOutNoticeStore.set(null);
}

/**
 * A 401: the token expired or was revoked. Nothing is wiped. The token goes, the
 * profile and the queued writes stay, the outbox pauses (it needs a token) and the
 * login screen asks the same person to sign in again.
 */
export const expireSession = sessionManager.expire;

/** Swaps a token older than a day for a fresh one, so an active phone never hits the expiry. */
export const refreshSessionIfStale = sessionManager.refreshIfStale;

AppState.addEventListener("change", (status) => {
  if (status === "active") void refreshSessionIfStale();
});

/** Wipes the session and everything of this user's from the phone, and signs out of Google. */
async function forgetUser(): Promise<void> {
  await sessionManager.forget();
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

/** A line for the login screen after the account itself went away (deleted). */
export const signedOutNoticeStore = createStore<string | null>(null);

/**
 * Deletes the account and all its data on the server (DELETE /auth/account), then
 * wipes the phone. Throws an ApiError (for lib/error-copy.ts) if the server didn't
 * delete it; the phone is left untouched in that case.
 */
export async function deleteAccount(): Promise<void> {
  const response = await request(apiUrl("/auth/account"), { method: "DELETE", timeout: 30_000 });
  if (!response.ok) throw apiErrorFrom(response.status, await response.json().catch(() => null));
  await forgetUser();
  signedOutNoticeStore.set("Your account and everything in it were deleted.");
}

connectAuth({ token: () => tokenStore.get(), onUnauthorized: sessionManager.onUnauthorized });
