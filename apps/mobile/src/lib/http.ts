import ky, { isNetworkError, isTimeoutError } from "ky";
import { API_URL } from "./config";
import { noteServerTime } from "./server-clock";

/** Most calls are quick; the chat assistant's tool loop and voice notes get longer. */
const TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 90_000;

/** Supplied by the auth module, so this one stays free of it (no import cycle). */
let auth: {
  token: () => string | null | undefined;
  /** The server refused this token; the auth module decides whether it still matters. */
  onUnauthorized: (sentToken: string | null) => void;
} = {
  token: () => null,
  onUnauthorized: () => {},
};

export function connectAuth(handlers: typeof auth): void {
  auth = handlers;
}

/** The server can't be reached (offline, timed out, or not running). Writes retry later. */
export class ServerUnreachableError extends Error {
  constructor() {
    // Logged, never shown: lib/error-copy.ts says it to people.
    super(`Can't reach ${API_URL}`);
    this.name = "ServerUnreachableError";
  }
}

/**
 * Every request to the API goes through this ky instance: one place for the
 * timeout, the sign-in token and marking the session expired on 401. Error bodies
 * are left for callers to turn into ApiError; TanStack Query and the outbox own retries.
 */
export const http = ky.create({
  timeout: TIMEOUT_MS,
  retry: 0,
  throwHttpErrors: false,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = auth.token();
        if (token && !request.headers.has("authorization"))
          request.headers.set("authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      ({ request, response }) => {
        // A refused sign-in is not an expired session: there is no session yet.
        if (response.status !== 401 || request.url.includes("/auth/google")) return;
        // A 401 for a token that has since been refreshed says nothing about the new one.
        const token = auth.token();
        if (token && request.headers.get("authorization") === `Bearer ${token}`)
          auth.onUnauthorized(token);
      },
    ],
  },
});

/** Runs a ky request, turning network failures and timeouts into one friendly error. */
export async function request(
  input: string,
  options: Parameters<typeof http>[1] = {},
): Promise<Response> {
  try {
    const sentAt = Date.now();
    const response = await http(input, {
      timeout: input.includes("/ai/") ? AI_TIMEOUT_MS : TIMEOUT_MS,
      ...options,
    });
    noteServerTime(Number(response.headers.get("x-server-time")), sentAt, Date.now());
    return response;
  } catch (error) {
    if (isNetworkError(error) || isTimeoutError(error)) throw new ServerUnreachableError();
    throw error;
  }
}

/** fetch-compatible adapter so the typed Hono client also goes through ky. */
export const kyFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  request(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    init as Parameters<typeof http>[1],
  );

export const apiUrl = (path: string): string => `${API_URL}${path}`;

/** The token requests are sent with now, if signed in. */
export function currentToken(): string | null {
  return auth.token() ?? null;
}

/** For requests that can't go through ky, such as the assistant's event stream. */
export function authHeaders(): Record<string, string> {
  const token = auth.token();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** A 401 from outside ky, for the token the request was sent with. */
export function reportUnauthorized(sentToken: string | null): void {
  auth.onUnauthorized(sentToken);
}
