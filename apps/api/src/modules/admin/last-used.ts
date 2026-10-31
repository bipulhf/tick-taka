import type { Database } from "bun:sqlite";
import type { DbHandle } from "../../db/client";
import { readFlag } from "../settings/service";

interface Source {
  table: string;
  /** SQL that is true for rows the server made on its own; they're skipped. */
  byServer?: string;
  /** SQL for when the person last touched a row, if the server may have changed it since. */
  at?: string;
}

/**
 * When each feature was last used, from the newest `updated_at` in its tables. A
 * date only, never what was written. Rows the server wrote by itself don't count:
 * the defaults seeded on sign-up, the monthly goal task the server makes, and a
 * bill the nightly job marks overdue.
 */
export const FEATURES = [
  {
    kind: "tasks",
    label: "Tasks",
    sources: [{ table: "tasks", byServer: "goal_id IS NOT NULL AND updated_at = created_at" }],
  },
  { kind: "projects", label: "Projects", sources: [{ table: "projects" }] },
  { kind: "habits", label: "Habits", sources: [{ table: "habits" }, { table: "habit_logs" }] },
  { kind: "time", label: "Time tracking", sources: [{ table: "time_entries" }] },
  {
    kind: "routines",
    label: "Routines",
    sources: [{ table: "routines" }, { table: "routine_steps" }],
  },
  { kind: "transactions", label: "Transactions", sources: [{ table: "transactions" }] },
  { kind: "budgets", label: "Budgets", sources: [{ table: "budgets" }] },
  {
    kind: "recurring",
    label: "Bills and income",
    // Marking a bill overdue moves updated_at; the person's own last touch is then unknown,
    // so the row counts from when it was made.
    sources: [
      {
        table: "recurring",
        at: "CASE WHEN overdue_at = updated_at THEN created_at ELSE updated_at END",
      },
    ],
  },
  { kind: "goals", label: "Goals", sources: [{ table: "goals" }] },
  { kind: "debts", label: "Debts", sources: [{ table: "debts" }] },
  { kind: "events", label: "Events", sources: [{ table: "events" }] },
  { kind: "assistant", label: "Tiki chat", sources: [{ table: "assistant_threads" }] },
] as const satisfies readonly { kind: string; label: string; sources: readonly Source[] }[];

export type FeatureKind = (typeof FEATURES)[number]["kind"];

/**
 * The newest change after `after` that the server didn't make. On the busy tables
 * this walks the updated_at index from the top and stops at the first match.
 */
function newest(sqlite: Database, source: Source, after: number): number | null {
  const at = source.at ?? "updated_at";
  const skip = source.byServer ? `AND NOT (${source.byServer})` : "";
  try {
    const row = sqlite
      .query<{ at: number }, [number]>(
        `SELECT ${at} AS at FROM "${source.table}" WHERE ${at} > ?1 ${skip}
         ORDER BY ${at} DESC LIMIT 1`,
      )
      .get(after);
    return row?.at ?? null;
  } catch {
    return null;
  }
}

/** Each feature's last use in one user's database; null when never used. */
export function lastUsedByFeature({ db, sqlite }: DbHandle): Record<FeatureKind, number | null> {
  const seededAt = Number(readFlag(db, "_seededAt") ?? 0) || 0;
  const result = {} as Record<FeatureKind, number | null>;
  for (const feature of FEATURES) {
    let last: number | null = null;
    for (const source of feature.sources as readonly Source[]) {
      const at = newest(sqlite, source, seededAt);
      if (at !== null && (last === null || at > last)) last = at;
    }
    result[feature.kind] = last;
  }
  return result;
}
