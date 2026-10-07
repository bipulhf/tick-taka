import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toLocalDate } from "@tick-taka/shared/dates";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { latestToday, nextDateCheckMs } from "./local-day";
import { fetchToday, keys, type TodayData, useSettings } from "./queries";
import { type UserTime, userTime } from "./user-time";

/** The user's time zone and first weekday, from Settings (shared defaults while loading). */
export function useUserTime(): UserTime {
  const { data: settings } = useSettings();
  return userTime(settings);
}

/**
 * Today as "YYYY-MM-DD" in the user's time zone, not the app's default zone. The one
 * place a screen gets today's date: it turns over at local midnight even with the
 * app open, and is checked again when the app comes back to the front.
 */
export function useTodayDate(): string {
  const { timeZone } = useUserTime();
  const [date, setDate] = useState(() => toLocalDate(Date.now(), timeZone));
  useEffect(() => {
    const update = () => setDate(toLocalDate(Date.now(), timeZone));
    update();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          update();
          schedule();
        },
        nextDateCheckMs(Date.now(), timeZone),
      );
    };
    schedule();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") update();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [timeZone]);
  return date;
}

/** This month as "YYYY-MM" in the user's time zone; turns over with useTodayDate(). */
export function useThisMonth(): string {
  return useTodayDate().slice(0, 7);
}

/**
 * Today's screen data, keyed by the local date so a new day is a new query. Until
 * the new day loads (or while offline) the newest cached day is shown as a
 * placeholder; compare `data.date` with useTodayDate() to say it's older.
 */
export function useToday(date?: string) {
  const localToday = useTodayDate();
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.today(date ?? localToday),
    queryFn: () => fetchToday(date),
    placeholderData: date
      ? undefined
      : (previous: TodayData | undefined) =>
          previous ??
          latestToday(
            client.getQueriesData<TodayData>({ queryKey: ["today"] }).map(([, data]) => data),
          ),
  });
}
