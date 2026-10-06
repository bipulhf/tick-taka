/**
 * Which cached screens a write can change, by the first segment of its path. Writes
 * to anything not listed (settings, reviews, new routes) refresh everything, so a
 * missing entry costs a few extra requests, never a stale screen.
 */

/** Summaries built from both tasks and money. */
const SHARED = [
  "today",
  "insights",
  "gamification",
  "area-dashboard",
  "review-weekly",
  "review-monthly",
  "review-shutdown",
];

const MONEY = [
  "transactions",
  "transaction",
  "accounts",
  "budgets",
  "recurring",
  "subscriptions",
  "goals",
  "debts",
  "debt-forecast",
  "events",
  "shopping",
  "shopping-lists",
  "categories",
  "category-rules",
  "net-worth",
  "monthly-series",
  "hourly-rate",
];

const TIME = [
  "tasks",
  "task",
  "projects",
  "areas",
  "habits",
  "routines",
  "timer",
  "time-entries",
  "focus-stats",
  "hourly-rate",
];

const MONEY_ROUTES = new Set([
  "transactions",
  "accounts",
  "budgets",
  "recurring",
  "goals",
  "debts",
  "events",
  "shopping",
  "categories",
  "category-rules",
]);

const TIME_ROUTES = new Set(["tasks", "projects", "habits", "routines", "timer", "time-entries"]);

/** Areas are shared: tasks, time and transactions are all tagged with one. */
const BOTH_ROUTES = new Set(["areas"]);

/** First-level query keys to refresh after writes to these paths, or "all". */
export function keysToRefresh(paths: Iterable<string>): Set<string> | "all" {
  const keys = new Set<string>();
  for (const path of paths) {
    const route = path.split(/[/?]/)[1] ?? "";
    const groups = MONEY_ROUTES.has(route)
      ? [MONEY]
      : TIME_ROUTES.has(route)
        ? [TIME]
        : BOTH_ROUTES.has(route)
          ? [MONEY, TIME]
          : null;
    if (!groups) return "all";
    for (const group of groups) for (const key of group) keys.add(key);
    for (const key of SHARED) keys.add(key);
  }
  return keys;
}
