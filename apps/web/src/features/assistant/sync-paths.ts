import { z } from "zod";

/** Reply of GET /sync/changes, checked before use. */
export const syncChangesSchema = z.object({
  serverTime: z.number(),
  changes: z.record(z.string(), z.array(z.unknown())),
  /** Some table had more rows than the reply's limit. */
  more: z.boolean().optional(),
});

/**
 * GET /sync/changes answers with rows per database table. These are the REST
 * routes those tables live under, so a change can refresh exactly the views a
 * write to that route would (lib/invalidation.ts). Pure, so it can be tested.
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
  category_rules: "/category-rules",
};

/**
 * Routes whose data changed, one per route, from a /sync/changes reply. Tables
 * with no rows are skipped; a table this build doesn't know maps to "/", which
 * refreshes everything rather than leave a view stale.
 */
export function changedPaths(changes: Record<string, unknown[]>): string[] {
  const paths = new Set<string>();
  for (const [table, rows] of Object.entries(changes))
    if (rows.length > 0) paths.add(TABLE_PATHS[table] ?? "/");
  return [...paths];
}
