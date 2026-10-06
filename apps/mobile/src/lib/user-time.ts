import { DEFAULT_TIME_ZONE, DEFAULT_WEEK_STARTS_ON } from "@tick-taka/shared/dates";

export interface UserTime {
  timeZone: string;
  weekStartsOn: number;
}

/**
 * The user's time zone and first weekday, with the shared defaults while settings
 * are still loading. The one place the fallback lives (the server's userTime(deps)).
 */
export function userTime(
  settings?: { timeZone?: string | null; weekStartsOn?: number | null } | null,
): UserTime {
  return {
    timeZone: settings?.timeZone || DEFAULT_TIME_ZONE,
    weekStartsOn: settings?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON,
  };
}
