/**
 * Whether a cold start opens locked. The phone's own copy of the setting decides,
 * because the server settings arrive from the persisted cache only after the first
 * render. With no copy yet (first start after updating), the settings decide once
 * they load. null: not known yet.
 */
export function coldStartLocked(
  devicePref: boolean | null,
  settingsAppLock: boolean | undefined,
): boolean | null {
  if (devicePref !== null) return devicePref;
  return settingsAppLock ?? null;
}
