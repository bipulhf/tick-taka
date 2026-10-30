import { apiErrorFrom } from "./api";
import { DEMO_SIGN_IN } from "./config";
import { apiUrl, connectAuth, request } from "./http";
import { queryClient } from "./query-client";
import {
  ISSUED_KEY,
  needsRefresh,
  PROFILE_KEY,
  type Profile,
  readStoredSession,
  type SessionResponse,
  sessionResponseSchema,
  TOKEN_KEY,
} from "./session";
import { createStore } from "./store";

export type { Profile } from "./session";

const stored = readStoredSession(localStorage);

/** The session token, or `null` when signed out or expired. */
export const tokenStore = createStore<string | null>(stored.token);
/** Who is signed in, for the account row. */
export const profileStore = createStore<Profile | null>(stored.profile);
/** A line for the sign-in page after the session ended or the account went away. */
export const signedOutNoticeStore = createStore<string | null>(null);

let issuedAt = stored.issuedAt;

function save(session: SessionResponse): void {
  issuedAt = Date.now();
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(session.user));
    localStorage.setItem(ISSUED_KEY, String(issuedAt));
  } catch {
    // Private windows can refuse storage; the session still lasts for this tab.
  }
  profileStore.set(session.user);
  tokenStore.set(session.token);
  signedOutNoticeStore.set(null);
}

/** Forgets the session and every cached screen of this user's. */
function forget(): void {
  for (const key of [TOKEN_KEY, PROFILE_KEY, ISSUED_KEY]) localStorage.removeItem(key);
  issuedAt = null;
  tokenStore.set(null);
  profileStore.set(null);
  queryClient.clear();
}

/** Trades a response from the sign-in or refresh routes for a saved session. */
async function takeSession(response: Response): Promise<void> {
  const body: unknown = await response.json().catch(() => null);
  const session = response.ok ? sessionResponseSchema.safeParse(body) : null;
  // An ApiError, so the sign-in page words it through lib/error-copy.ts.
  if (!session?.success) throw apiErrorFrom(response.ok ? 502 : response.status, body);
  // Someone else's cached screens never show for this person.
  if (profileStore.get()?.id !== session.data.user.id) queryClient.clear();
  save(session.data);
}

/** Trades the ID token from Google's button for our own session. */
export async function signInWithGoogle(idToken: string): Promise<void> {
  const response = await request(apiUrl("/auth/google"), {
    method: "POST",
    json: { idToken },
    timeout: 15_000,
  });
  await takeSession(response);
}

/**
 * Development and screenshot builds only: signs in with a token minted by the API's
 * demo script (apps/api/scripts/demo.ts). Real builds refuse it.
 */
export async function signInWithDemoToken(token: string): Promise<void> {
  if (!DEMO_SIGN_IN) throw new Error("Not available in this build");
  const response = await request(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  await takeSession(response);
}

let refreshing: Promise<void> | null = null;

/** Swaps a token older than a day for a fresh one, so an active browser never hits the expiry. */
export function refreshSessionIfStale(): Promise<void> {
  if (!tokenStore.get() || !needsRefresh(issuedAt, Date.now())) return Promise.resolve();
  refreshing ??= (async () => {
    try {
      const response = await request(apiUrl("/auth/refresh"), { method: "POST", timeout: 15_000 });
      if (response.ok) await takeSession(response);
    } catch {
      // Offline or the server is down: the token still works; try again next time.
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Signs out here and on the server, and clears everything of this user's from the browser. */
export async function signOut(): Promise<void> {
  if (tokenStore.get()) {
    // Best effort: the session expires on its own anyway.
    await request(apiUrl("/auth/logout"), { method: "POST", timeout: 5_000 }).catch(() => {});
  }
  forget();
  window.google?.accounts.id.disableAutoSelect();
}

/**
 * Deletes the account and all its data on the server, then clears the browser.
 * Throws an ApiError if the server didn't delete it; nothing is cleared in that case.
 */
export async function deleteAccount(): Promise<void> {
  const response = await request(apiUrl("/auth/account"), { method: "DELETE", timeout: 30_000 });
  if (!response.ok) throw apiErrorFrom(response.status, await response.json().catch(() => null));
  forget();
  signedOutNoticeStore.set("Your account and everything in it were deleted.");
}

connectAuth({
  token: () => tokenStore.get(),
  onUnauthorized: (sentToken) => {
    if (sentToken !== tokenStore.get()) return;
    const profile = profileStore.get();
    forget();
    // Kept so the sign-in page can greet them by name.
    profileStore.set(profile);
    signedOutNoticeStore.set("You were signed out. Sign in again to carry on.");
  },
});

window.addEventListener("focus", () => void refreshSessionIfStale());
// Another tab signed in or out: follow it.
window.addEventListener("storage", (event) => {
  if (event.key !== TOKEN_KEY) return;
  const next = readStoredSession(localStorage);
  issuedAt = next.issuedAt;
  profileStore.set(next.profile);
  tokenStore.set(next.token);
  if (!next.token) queryClient.clear();
});
