import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./api";

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

export function useToday(date?: string) {
  return useQuery({
    queryKey: keys.today(date),
    queryFn: () => unwrap(api.today.$get({ query: date ? { date } : {} })),
  });
}

export type TodayData = NonNullable<ReturnType<typeof useToday>["data"]>;
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
    ready: Boolean(settings.data && accounts.data && categories.data && areas.data),
  };
}
