/** Set EXPO_PUBLIC_API_URL in apps/mobile/.env (dev) or eas.json (builds). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000").replace(
  /\/$/,
  "",
);

/**
 * The Google Cloud OAuth "Web application" client ID. Google issues the phone an
 * ID token addressed to it, which the server checks (GOOGLE_CLIENT_IDS).
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
