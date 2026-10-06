import type { Database } from "bun:sqlite";

export type JobRunStore = ReturnType<typeof createJobRunStore>;

/**
 * The local date each nightly job last succeeded for each user, in users.db, so
 * a job missed while the server was down runs on the next tick instead of
 * waiting a day.
 */
export function createJobRunStore(registry: Database) {
  registry.exec(`CREATE TABLE IF NOT EXISTS job_runs (
    user_id TEXT NOT NULL,
    job TEXT NOT NULL,
    local_date TEXT NOT NULL,
    ran_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, job)
  )`);
  const last = registry.query<{ local_date: string }, [string, string]>(
    "SELECT local_date FROM job_runs WHERE user_id = ? AND job = ?",
  );
  const record = registry.query(
    `INSERT INTO job_runs (user_id, job, local_date, ran_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, job) DO UPDATE SET local_date = excluded.local_date, ran_at = excluded.ran_at`,
  );
  const removeForUser = registry.query("DELETE FROM job_runs WHERE user_id = ?");

  return {
    lastDate(userId: string, job: string): string | undefined {
      return last.get(userId, job)?.local_date;
    },
    record(userId: string, job: string, localDate: string, at: number): void {
      record.run(userId, job, localDate, at);
    },
    removeForUser(userId: string): void {
      removeForUser.run(userId);
    },
  };
}
