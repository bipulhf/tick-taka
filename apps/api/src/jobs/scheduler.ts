import { Cron } from "croner";
import type { Deps } from "../lib/deps";
import { recurringService } from "../modules/recurring/service";
import { readSettings } from "../modules/settings/service";
import { runBackup } from "./backup";

/**
 * In-process jobs (croner, in the user's time zone). pm2 runs exactly one instance,
 * so each job runs once.
 */
export function startJobs(deps: Deps): () => void {
  const timezone = readSettings(deps.db).timeZone;
  const safely = (name: string, job: () => unknown) => () => {
    try {
      const result = job();
      console.log(`[job] ${name}: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`[job] ${name} failed`, error);
    }
  };
  const jobs = [
    new Cron(
      "5 0 * * *",
      { timezone, name: "overdue-bills" },
      safely("overdue-bills", () => recurringService(deps).markOverdue()),
    ),
    new Cron(
      "0 3 * * *",
      { timezone, name: "nightly-backup" },
      safely("nightly-backup", () =>
        runBackup(deps.sqlite, deps.env.BACKUPS_DIR, deps.now(), timezone),
      ),
    ),
  ];
  return () => {
    for (const job of jobs) job.stop();
  };
}
