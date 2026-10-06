import type { Database } from "bun:sqlite";

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

interface TotalsRow {
  user_id: string;
  month: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_micros: number;
}

export type UsageTotalStore = ReturnType<typeof createUsageTotalStore>;

/**
 * Each user's AI use per month (their own local month), kept in users.db as calls
 * are logged, so the owner's report across every user reads one small table
 * instead of opening every user's database.
 */
export function createUsageTotalStore(registry: Database) {
  registry.exec(`CREATE TABLE IF NOT EXISTS ai_usage_totals (
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    calls INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_micros INTEGER NOT NULL,
    PRIMARY KEY (user_id, month)
  )`);
  const add = registry.query(
    `INSERT INTO ai_usage_totals (user_id, month, calls, input_tokens, output_tokens, cost_micros)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (user_id, month) DO UPDATE SET calls = calls + ?3,
       input_tokens = input_tokens + ?4, output_tokens = output_tokens + ?5,
       cost_micros = cost_micros + ?6`,
  );
  const set = registry.query(
    `INSERT INTO ai_usage_totals (user_id, month, calls, input_tokens, output_tokens, cost_micros)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (user_id, month) DO UPDATE SET calls = ?3, input_tokens = ?4,
       output_tokens = ?5, cost_micros = ?6`,
  );
  const forMonth = registry.query<TotalsRow, [string]>(
    "SELECT * FROM ai_usage_totals WHERE month = ?",
  );
  const removeForUser = registry.query("DELETE FROM ai_usage_totals WHERE user_id = ?");
  const args = (userId: string, month: string, t: UsageTotals) =>
    [userId, month, t.calls, t.inputTokens, t.outputTokens, t.costMicros] as const;

  return {
    /** Adds one logged call (or several) to the user's month. */
    add(userId: string, month: string, totals: UsageTotals): void {
      add.run(...args(userId, month, totals));
    },
    /** Replaces the user's months with totals counted from their own database. */
    replace(userId: string, months: Map<string, UsageTotals>): void {
      registry.transaction(() => {
        for (const [month, totals] of months) set.run(...args(userId, month, totals));
      })();
    },
    /** Every user's totals for one month, by user id. */
    forMonth(month: string): Map<string, UsageTotals> {
      return new Map(
        forMonth.all(month).map((row) => [
          row.user_id,
          {
            calls: row.calls,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            costMicros: row.cost_micros,
          },
        ]),
      );
    },
    removeForUser(userId: string): void {
      removeForUser.run(userId);
    },
  };
}
