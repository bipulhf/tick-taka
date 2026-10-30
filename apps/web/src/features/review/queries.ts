import { useQuery } from "@tanstack/react-query";
import { endOfLocalDay, startOfLocalDay } from "@tick-taka/shared/dates";
import { api, unwrap } from "@/lib/api";

export const useWeeklyReview = (weekStart?: string) =>
  useQuery({
    queryKey: ["review-weekly", weekStart ?? "current"],
    queryFn: () => unwrap(api.reviews.weekly.$get({ query: weekStart ? { weekStart } : {} })),
  });

export const useMonthlyReview = (month?: string) =>
  useQuery({
    queryKey: ["review-monthly", month ?? "current"],
    queryFn: () => unwrap(api.reviews.monthly.$get({ query: month ? { month } : {} })),
  });

export const SHUTDOWN_KEY = ["review-shutdown"] as const;

export const useShutdown = () =>
  useQuery({
    queryKey: SHUTDOWN_KEY,
    queryFn: () => unwrap(api.reviews.shutdown.$get({ query: {} })),
  });

export type ShutdownData = NonNullable<ReturnType<typeof useShutdown>["data"]>;

/** Tasks finished on `date`, for the shutdown's first step. */
export const useDoneOn = (date: string, timeZone: string) =>
  useQuery({
    queryKey: ["tasks", "done-on", date],
    queryFn: () =>
      unwrap(
        api.tasks.$get({
          query: {
            status: "done",
            doneFrom: String(startOfLocalDay(date, timeZone)),
            doneTo: String(endOfLocalDay(date, timeZone)),
          },
        }),
      ),
  });

/** Open tasks planned for `date` or earlier: what the shutdown offers to carry over. */
export const useUnfinishedBy = (date: string, timeZone: string) =>
  useQuery({
    queryKey: ["tasks", "unfinished-by", date],
    queryFn: () =>
      unwrap(
        api.tasks.$get({
          query: { status: "inbox,open", to: String(endOfLocalDay(date, timeZone)) },
        }),
      ),
  });

export const useNetWorth = (months = 12) =>
  useQuery({
    queryKey: ["net-worth", months],
    queryFn: () => unwrap(api.insights["net-worth"].$get({ query: { months: String(months) } })),
  });

export const useMonthlySeries = (months = 6) =>
  useQuery({
    queryKey: ["monthly-series", months],
    queryFn: () => unwrap(api.insights.monthly.$get({ query: { months: String(months) } })),
  });

export const useAreaDashboard = () =>
  useQuery({
    queryKey: ["area-dashboard"],
    queryFn: () => unwrap(api.insights.areas.$get({ query: {} })),
  });

export const useSubscriptions = () =>
  useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => unwrap(api.insights.subscriptions.$get()),
  });

export const useGamification = () =>
  useQuery({ queryKey: ["gamification"], queryFn: () => unwrap(api.gamification.$get()) });

export const useAiUsage = (month?: string) =>
  useQuery({
    queryKey: ["ai-usage", month ?? "current"],
    queryFn: () => unwrap(api.ai.usage.$get({ query: month ? { month } : {} })),
  });
