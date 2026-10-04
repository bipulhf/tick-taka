/** Set EXPO_PUBLIC_API_URL in apps/mobile/.env (dev) or eas.json (builds). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000").replace(
  /\/$/,
  "",
);
