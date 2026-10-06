import { describe, expect, test } from "bun:test";
import {
  ISSUED_KEY,
  mustWipeBeforeSignIn,
  needsRefresh,
  PROFILE_KEY,
  readStoredSession,
  sessionResponseSchema,
  TOKEN_KEY,
} from "../src/lib/session";

const profile = { id: "u1", email: "a@b.c", name: "A", pictureUrl: null };
const store = (values: Record<string, string>) => async (key: string) => values[key] ?? null;

describe("reading the stored session at start-up", () => {
  test("a saved token and profile come back as they were", async () => {
    const session = await readStoredSession(
      store({ [TOKEN_KEY]: "jwt", [PROFILE_KEY]: JSON.stringify(profile), [ISSUED_KEY]: "1000" }),
    );
    expect(session).toEqual({ token: "jwt", profile, issuedAt: 1000, broken: false });
  });

  test("secure storage that throws means signed out, not a hung splash screen", async () => {
    const session = await readStoredSession(async () => {
      throw new Error("Keystore invalidated");
    });
    expect(session).toEqual({ token: null, profile: null, issuedAt: null, broken: true });
  });

  test("a corrupt or wrong-shaped profile is dropped, the token kept", async () => {
    for (const raw of ["{not json", JSON.stringify({ id: 5 })]) {
      const session = await readStoredSession(store({ [TOKEN_KEY]: "jwt", [PROFILE_KEY]: raw }));
      expect(session.token).toBe("jwt");
      expect(session.profile).toBeNull();
      expect(session.issuedAt).toBeNull();
    }
  });
});

describe("session lifetime", () => {
  test("a token is refreshed once it is a day old, or when its age is unknown", () => {
    const now = 10 * 86_400_000;
    expect(needsRefresh(now - 3_600_000, now)).toBe(false);
    expect(needsRefresh(now - 86_400_000, now)).toBe(true);
    expect(needsRefresh(null, now)).toBe(true);
  });

  test("signing back in as the same person keeps the phone's data and queue", () => {
    expect(mustWipeBeforeSignIn("u1", "u1")).toBe(false);
    expect(mustWipeBeforeSignIn(null, "u1")).toBe(false);
  });

  test("a different account signing in wipes the previous one's data first", () => {
    expect(mustWipeBeforeSignIn("u1", "u2")).toBe(true);
  });

  test("sign-in and refresh replies are checked before they are trusted", () => {
    const good = { token: "jwt", expiresAt: 1, user: profile, created: false };
    expect(sessionResponseSchema.safeParse(good).success).toBe(true);
    expect(sessionResponseSchema.safeParse({ token: "jwt", user: { id: "u1" } }).success).toBe(
      false,
    );
    expect(sessionResponseSchema.safeParse({ token: "", user: profile }).success).toBe(false);
  });
});
