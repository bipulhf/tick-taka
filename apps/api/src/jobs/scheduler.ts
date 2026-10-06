import { localParts } from "@tick-taka/shared/dates";
import { Cron } from "croner";
import type { Deps } from "../lib/deps";
import { runAsUser } from "../lib/user-scope";
import { recurringService } from "../modules/recurring/service";
import { readSettings } from "../modules/settings/service";
import { runBackup } from "./backup";

/** Local hour, in each user's own time zone, at which each nightly job runs. */
const OVERDUE_BILLS_HOUR = 0;
const BACKUP_HOUR = 3;

/** Lets requests waiting on the event loop run between one user's jobs and the next. */
const yieldToRequests = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Runs each user's nightly jobs when it is the right hour in their time zone.
 * Called a few minutes past every hour. Users are handled one at a time with a
 * yield in between, so a long run never holds up requests for everyone.
 */
export async function runHourlyJobs(deps: Deps): Promise<void> {
  const now = deps.now();
  for (const user of deps.users.list()) {
    await yieldToRequests();
    const lease = deps.users.lease(user);
    const { data } = lease;
    try {
      runAsUser({ user, data }, () => {
        const timeZone = readSettings(data.db).timeZone;
        const { hour } = localParts(now, timeZone);
        const safely = (name: string, job: () => unknown) => {
          try {
            const result = job();
            console.log(`[job] ${name} for ${user.id}: ${JSON.stringify(result)}`);
          } catch (error) {
            console.error(`[job] ${name} for ${user.id} failed`, error);
          }
        };
        if (hour === OVERDUE_BILLS_HOUR)
          safely("overdue-bills", () => recurringService(deps).markOverdue());
        if (hour === BACKUP_HOUR)
          safely("nightly-backup", () => runBackup(data.sqlite, data.backupsDir, now, timeZone));
      });
    } finally {
      // Databases opened only for the jobs don't stay open.
      lease.release({ closeIfOpened: true });
    }
  }
  deps.users.sweep();
}

/** In-process jobs (croner). pm2 runs exactly one instance, so each job runs once. */
export function startJobs(deps: Deps): () => void {
  const job = new Cron("5 * * * *", { name: "per-user-jobs", protect: true }, () =>
    runHourlyJobs(deps),
  );
  return () => job.stop();
}
