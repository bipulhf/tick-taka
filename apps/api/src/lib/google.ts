import { verifyWithJwks } from "hono/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/jws";
import type { GoogleVerifier } from "./deps";
import { unauthorized } from "./errors";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER = /^(https:\/\/)?accounts\.google\.com$/;
/** Used when Google's response carries no max-age. */
const DEFAULT_KEYS_TTL_MS = 60 * 60 * 1000;

/**
 * Verifies Google ID tokens from the phone's native sign-in: signature against
 * Google's published keys (cached for as long as Google says), issuer, expiry,
 * an audience that is one of our client IDs, and a verified email.
 */
export function createGoogleVerifier(
  clientIds: string[],
  fetchKeys: typeof fetch = fetch,
): GoogleVerifier {
  let cache: { keys: HonoJsonWebKey[]; expiresAt: number } | null = null;

  async function keys(refresh: boolean): Promise<HonoJsonWebKey[]> {
    if (cache && !refresh && cache.expiresAt > Date.now()) return cache.keys;
    const response = await fetchKeys(CERTS_URL);
    if (!response.ok) throw new Error(`Google keys request failed: ${response.status}`);
    const body = (await response.json()) as { keys: HonoJsonWebKey[] };
    const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1];
    cache = {
      keys: body.keys,
      expiresAt: Date.now() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_KEYS_TTL_MS),
    };
    return cache.keys;
  }

  const verifyWith = async (idToken: string, refresh: boolean) =>
    verifyWithJwks(idToken, {
      keys: await keys(refresh),
      allowedAlgorithms: ["RS256"],
      verification: { iss: GOOGLE_ISSUER, aud: clientIds },
    });

  return async (idToken) => {
    let payload: Awaited<ReturnType<typeof verifyWith>>;
    try {
      payload = await verifyWith(idToken, false).catch(
        // Google rotates its keys; a token signed with a new key needs a fresh fetch.
        () => verifyWith(idToken, true),
      );
    } catch {
      throw unauthorized("Google sign-in didn't check out. Try again.");
    }
    if (typeof payload.sub !== "string" || typeof payload.email !== "string")
      throw unauthorized("Google didn't share an email for this account");
    if (payload.email_verified !== true)
      throw unauthorized("Verify this Google account's email first");
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  };
}
