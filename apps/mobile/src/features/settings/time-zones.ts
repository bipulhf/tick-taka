import { isTimeZone, timeZoneOffsetMs } from "@tick-taka/shared/dates";

/**
 * Zones offered in Settings › Today and planning: home first, then where people from
 * home most often are. Any other IANA zone (set by the phone or elsewhere) is listed
 * too, so the field always names the zone in use.
 */
export const COMMON_TIME_ZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;

/** The zone this phone is set to, or null when it can't say or the clock can't use it. */
export function phoneTimeZone(
  resolve: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string | null {
  try {
    const zone = resolve();
    return zone && isTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/** "GMT+6", "GMT+5:45", "GMT-4" at `now` (so summer time shows as it is today). */
export function gmtOffset(zone: string, now: number): string {
  const minutes = Math.round(timeZoneOffsetMs(now, zone) / 60_000);
  if (minutes === 0) return "GMT";
  const sign = minutes > 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** The zone's city as people say it: "Asia/Kuala_Lumpur" is "Kuala Lumpur". */
export function timeZoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** "Dhaka · GMT+6": the zone's city with its offset. */
export function timeZoneLabel(zone: string, now: number): string {
  return `${timeZoneCity(zone)} · ${gmtOffset(zone, now)}`;
}

/** The picker's options: the phone's zone first (when it's known), then the common ones. */
export function timeZoneOptions(
  phone: string | null,
  now: number,
): { id: string; label: string }[] {
  const zones = [...new Set([...(phone ? [phone] : []), ...COMMON_TIME_ZONES])];
  return zones.map((zone) => ({
    id: zone,
    label: zone === phone ? `${timeZoneLabel(zone, now)} (this phone)` : timeZoneLabel(zone, now),
  }));
}
