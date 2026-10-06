import { type LocalDate, safeTimeZone, toLocalDate } from "@tick-taka/shared/dates";
import type { Settings } from "@tick-taka/shared/schemas/settings";
import { readSettings } from "../modules/settings/service";
import type { Deps } from "./deps";

export interface UserTime {
  now: number;
  timeZone: string;
  today: LocalDate;
  settings: Settings;
}

/** "Now" in the user's time zone. Instants stay UTC; only the local date is derived. */
export function userTime(deps: Deps): UserTime {
  const settings = readSettings(deps.db);
  const now = deps.now();
  // readSettings already drops a stored zone that isn't valid; this keeps it that way.
  const timeZone = safeTimeZone(settings.timeZone);
  return { now, timeZone, today: toLocalDate(now, timeZone), settings };
}
