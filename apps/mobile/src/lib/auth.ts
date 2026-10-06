import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import { GOOGLE_WEB_CLIENT_ID } from "./config";
import { apiUrl, connectAuth, request } from "./http";
import { PROFILE_KEY, type Profile, readStoredSession, TOKEN_KEY } from "./session";
import { createStore } from "./store";
import { clearUserData } from "./user-data";

export type { Profile } from "./session";

/** `undefined` while loading from secure storage, `null` when signed out. */
export const tokenStore = createStore<string | null | undefined>(undefined);
/** Who is signed in, for the account row in Settings. */
export const profileStore = createStore<Profile | null>(null);

/** Reads the saved session. Always settles the token store, so start-up can't hang. */
export async function loadToken(): Promise<void> {
  const stored = await readStoredSession((key) => SecureStore.getItemAsync(key));
  if (stored.broken) {
    // Unreadable (Keystore reset or a restored backup): start again from the login screen.
    await Promise.all(
      [TOKEN_KEY, PROFILE_KEY].map((key) => SecureStore.deleteItemAsync(key).catch(() => {})),
    );
  }
  profileStore.set(stored.profile);
  tokenStore.set(stored.token);
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

/**
 * Native Google sign-in (Android's account picker, no browser), then trades the
 * Google ID token for our own session. A new Google account gets a fresh space.
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
  const body = (await response.json().catch(() => null)) as {
    token?: string;
    user?: Profile;
    error?: { message: string };
  } | null;
  if (!response.ok || !body?.token || !body.user) {
    // Let them pick a different account next time instead of reusing this one.
    await GoogleSignin.signOut().catch(() => {});
    throw new Error(body?.error?.message ?? "Couldn't reach the server");
  }
  await SecureStore.setItemAsync(TOKEN_KEY, body.token);
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(body.user));
  profileStore.set(body.user);
  tokenStore.set(body.token);
}

/** Signs out of the app and Google, and wipes everything of this user's from the phone. */
export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(PROFILE_KEY);
  tokenStore.set(null);
  profileStore.set(null);
  await Promise.all([GoogleSignin.signOut().catch(() => {}), clearUserData()]);
}

connectAuth({ token: () => tokenStore.get(), onUnauthorized: () => void signOut() });
