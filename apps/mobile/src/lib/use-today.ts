import { toLocalDate, toLocalMonth } from "@tick-taka/shared/dates";
import { useSettings } from "./queries";
import { type UserTime, userTime } from "./user-time";

/** The user's time zone and first weekday, from Settings (shared defaults while loading). */
export function useUserTime(): UserTime {
  const { data: settings } = useSettings();
  return userTime(settings);
}

/** Today as "YYYY-MM-DD" in the user's time zone, not the app's default zone. */
export function useToday(): string {
  return toLocalDate(Date.now(), useUserTime().timeZone);
}

/** This month as "YYYY-MM" in the user's time zone. */
export function useThisMonth(): string {
  return toLocalMonth(Date.now(), useUserTime().timeZone);
}
