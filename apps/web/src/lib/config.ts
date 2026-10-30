/**
 * Where the API is: "" for the same host, "/api" in development (Vite proxies it), or
 * a full URL such as https://api.example.com when it runs on its own host (the API
 * then lists this site in WEB_ORIGINS).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Absolute, because the typed Hono client builds URLs with `new URL`. */
export const API_URL = /^https?:\/\//.test(API_BASE)
  ? API_BASE
  : `${window.location.origin}${API_BASE}`;

/**
 * The Google Cloud OAuth "Web application" client ID, the same one the phone uses.
 * Google issues an ID token addressed to it, which the server checks (GOOGLE_CLIENT_IDS).
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

/** Only in builds for local development and screenshots; never set for real builds. */
export const DEMO_SIGN_IN = import.meta.env.VITE_DEMO_SIGN_IN === "1";
