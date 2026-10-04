import { useQuery } from "@tanstack/react-query";
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

export const useShutdown = () =>
  useQuery({
    queryKey: ["review-shutdown"],
    queryFn: () => unwrap(api.reviews.shutdown.$get({ query: {} })),
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
