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
