import { DEFAULT_WEEK_STARTS_ON, safeTimeZone } from "@tick-taka/shared/dates";

export interface UserTime {
  timeZone: string;
  weekStartsOn: number;
}

/**
 * The user's time zone and first weekday, with the shared defaults while settings
 * are still loading, or when a stored zone isn't one the clock can use. The one
 * place the fallback lives (the server's userTime(deps)).
 */
export function userTime(
  settings?: { timeZone?: string | null; weekStartsOn?: number | null } | null,
): UserTime {
  return {
    timeZone: safeTimeZone(settings?.timeZone),
    weekStartsOn: settings?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON,
  };
}
