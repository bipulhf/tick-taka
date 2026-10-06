import { describe, expect, test } from "bun:test";
import { ISSUED_KEY, PROFILE_KEY, readStoredSession, TOKEN_KEY } from "../src/lib/session";

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
