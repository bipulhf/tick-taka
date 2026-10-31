import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

/**
 * The owner's admin area. Query keys start with "admin" (refreshed with everything
 * after an admin action) and "me" (who is signed in, with isAdmin).
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => unwrap(api.me.$get()),
    staleTime: 5 * 60_000,
  });
}

/** Whether the signed-in person is the owner, who sees the admin area. */
export function useIsAdmin(): boolean {
  return useMe().data?.isAdmin === true;
}

export const useAdminOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => unwrap(api.admin.overview.$get()) });

export const useAdminUsers = () =>
  useQuery({ queryKey: ["admin", "users"], queryFn: () => unwrap(api.admin.users.$get()) });

export const useAdminUsage = () =>
  useQuery({ queryKey: ["admin", "usage"], queryFn: () => unwrap(api.admin.usage.$get()) });

export const useAdminAi = (month: string) =>
  useQuery({
    queryKey: ["admin", "ai", month],
    queryFn: () => unwrap(api.admin.ai.$get({ query: { month } })),
  });

export const useAdminHealth = () =>
  useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => unwrap(api.admin.health.$get()),
    refetchInterval: 30_000,
  });

export const useAdminAccess = () =>
  useQuery({ queryKey: ["admin", "access"], queryFn: () => unwrap(api.admin.access.$get()) });

export type AdminUser = NonNullable<ReturnType<typeof useAdminUsers>["data"]>[number];

/** "$1.23" from micro-dollars. */
export const dollars = (micros: number) =>
  `$${(micros / 1_000_000).toFixed(micros > 0 && micros < 10_000 ? 3 : 2)}`;

/** "12.4 MB" from bytes. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", or the date. */
export function ago(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
