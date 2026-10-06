import { z } from "zod";

/** Reply of GET /sync/changes, checked before use. */
export const syncChangesSchema = z.object({
  serverTime: z.number(),
  changes: z.record(z.string(), z.array(z.unknown())),
  /** Some table had more rows than the reply's limit. */
  more: z.boolean().optional(),
  /** With `summary=true`: how many rows changed per table, and no rows. */
  counts: z.record(z.string(), z.number()).optional(),
});

/**
 * GET /sync/changes answers with rows per database table. These are the REST
 * routes those tables live under, so a change can refresh exactly the screens a
 * write to that route would (see invalidation.ts). Pure, so it can be tested.
 */
const TABLE_PATHS: Record<string, string> = {
  settings: "/settings",
  areas: "/areas",
  projects: "/projects",
  tasks: "/tasks",
  time_entries: "/time-entries",
  habits: "/habits",
  habit_logs: "/habits",
  routines: "/routines",
  routine_steps: "/routines",
  accounts: "/accounts",
  categories: "/categories",
  transactions: "/transactions",
  budgets: "/budgets",
  recurring: "/recurring",
  goals: "/goals",
  debts: "/debts",
  events: "/events",
  shopping_items: "/shopping",
  category_rules: "/category-rules",
  sms_imports: "/transactions",
};

/**
 * Routes whose data changed, one per route, from a /sync/changes reply. Tables
 * with no rows are skipped; a table this build doesn't know maps to "/", which
 * refreshes everything rather than leave a screen stale.
 */
export function changedPaths(changes: Record<string, unknown[]>): string[] {
  return changedPathsFromCounts(
    Object.fromEntries(Object.entries(changes).map(([table, rows]) => [table, rows.length])),
  );
}

/** The same, from a `summary=true` reply's count of changed rows per table. */
export function changedPathsFromCounts(counts: Record<string, number>): string[] {
  const paths = new Set<string>();
  for (const [table, count] of Object.entries(counts))
    if (count > 0) paths.add(TABLE_PATHS[table] ?? "/");
  return [...paths];
}
