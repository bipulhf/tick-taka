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

/**
 * Runs each user's nightly jobs when it is the right hour in their time zone.
 * Called a few minutes past every hour.
 */
export function runHourlyJobs(deps: Deps): void {
  const now = deps.now();
  for (const user of deps.users.list()) {
    const data = deps.users.data(user);
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
  }
}

/** In-process jobs (croner). pm2 runs exactly one instance, so each job runs once. */
export function startJobs(deps: Deps): () => void {
  const job = new Cron("5 * * * *", { name: "per-user-jobs" }, () => runHourlyJobs(deps));
  return () => job.stop();
}
