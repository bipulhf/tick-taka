import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toLocalDate } from "@tick-taka/shared/dates";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api, unwrap } from "./api";
import { latestToday, nextDateCheckMs } from "./local-day";

/** Query keys in one place so writes can invalidate precisely when needed. */
export const keys = {
  today: (date?: string) => ["today", date ?? "now"] as const,
  settings: ["settings"] as const,
  areas: ["areas"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
};

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => unwrap(api.settings.$get()) });
}

export function useAreas() {
  return useQuery({ queryKey: keys.areas, queryFn: () => unwrap(api.areas.$get()) });
}

export function useAccounts() {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => unwrap(api.accounts.$get({ query: {} })),
  });
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => unwrap(api.categories.$get()) });
}

const fetchToday = (date?: string) => unwrap(api.today.$get({ query: date ? { date } : {} }));

export type TodayData = Awaited<ReturnType<typeof fetchToday>>;

/** Today's date where the user lives; turns over at local midnight even with the app open. */
export function useLocalToday(): string {
  const { data: settings } = useSettings();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
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

/**
 * Today's screen data, keyed by the local date so a new day is a new query. Until
 * the new day loads (or while offline) the newest cached day is shown as a
 * placeholder; compare `data.date` with useLocalToday() to say it's older.
 */
export function useToday(date?: string) {
  const localToday = useLocalToday();
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
export type TaskRow = TodayData["topThree"][number];

export function useCategoryRules() {
  return useQuery({
    queryKey: ["category-rules"],
    queryFn: () => unwrap(api["category-rules"].$get()),
  });
}

export function useHourlyRate() {
  return useQuery({
    queryKey: ["hourly-rate"],
    queryFn: () => unwrap(api.insights["hourly-rate"].$get()),
    staleTime: 3_600_000,
  });
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () => unwrap(api.ai.status.$get()),
    staleTime: 300_000,
  });
}

/** Everything the on-phone parser needs; all of it is in the persisted cache, so it works offline. */
export function useReference() {
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const areas = useAreas();
  const rules = useCategoryRules();
  return {
    settings: settings.data,
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    areas: areas.data ?? [],
    rules: rules.data ?? [],
    /** False until the account list has loaded once (it may just be offline). */
    accountsLoaded: accounts.data !== undefined,
    ready: Boolean(settings.data && accounts.data && categories.data && areas.data),
  };
}
