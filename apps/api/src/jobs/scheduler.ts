import { localParts, safeTimeZone, toLocalDate } from "@tick-taka/shared/dates";
import { Cron } from "croner";
import { usageTotalsByMonth } from "../ai/usage";
import type { User, UserData } from "../db/user-registry";
import type { Deps } from "../lib/deps";
import { errorFields, log, userTag } from "../lib/log";
import { runAsUser } from "../lib/user-scope";
import { recurringService } from "../modules/recurring/service";
import { readSettings } from "../modules/settings/service";
import { runBackup } from "./backup";
import { copyBackupsOffsite } from "./offsite";

interface NightlyJob {
  name: string;
  /** Local hour, in the user's own time zone, from which the job is due each day. */
  hour: number;
  run(deps: Deps, data: UserData, now: number, timeZone: string, user: User): unknown;
}

const JOBS: NightlyJob[] = [
  { name: "overdue-bills", hour: 0, run: (deps) => recurringService(deps).markOverdue() },
  {
    // Recounts users.db's AI totals from the user's own rows: fills in months from
    // before the totals existed, and any call whose total failed to record.
    name: "usage-totals",
    hour: 0,
    run: (deps, data, _now, timeZone, user) =>
      deps.users.usageTotals.replace(user.id, usageTotalsByMonth(data.db, timeZone)),
  },
  {
    name: "nightly-backup",
    hour: 3,
    run: (_deps, data, now, timeZone) => runBackup(data.sqlite, data.backupsDir, now, timeZone),
  },
];

/** Lets requests waiting on the event loop run between one user's jobs and the next. */
const yieldToRequests = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * One user's due jobs; returns the names of the jobs that ran. Throws only if the
 * user's database or settings can't be read.
 */
function runJobsFor(deps: Deps, user: User, now: number): string[] {
  const ran: string[] = [];
  const lease = deps.users.lease(user);
  const { data } = lease;
  const tag = userTag(user.id, deps.env.JWT_SECRET);
  try {
    runAsUser({ user, data }, () => {
      const timeZone = safeTimeZone(readSettings(data.db).timeZone);
      const { hour } = localParts(now, timeZone);
      const today = toLocalDate(now, timeZone);
      for (const job of JOBS) {
        if (hour < job.hour || deps.users.jobRuns.lastDate(user.id, job.name) === today) continue;
        try {
          const result = job.run(deps, data, now, timeZone, user);
          deps.users.jobRuns.record(user.id, job.name, today, now);
          ran.push(job.name);
          log("info", "job", { job: job.name, user: tag, result });
        } catch (error) {
          log("error", "job failed", { job: job.name, user: tag, ...errorFields(error) });
        }
      }
    });
  } finally {
    // Databases opened only for the jobs don't stay open.
    lease.release({ closeIfOpened: true });
  }
  return ran;
}

/**
 * Runs each user's nightly jobs that are due: past the job's local hour, and
 * not yet done for today's local date. A job missed while the server was down
 * (or one that failed) runs on the next tick. Users are handled one at a time
 * with a yield in between, so a long run never holds up requests for everyone,
 * and one user whose data can't be read is logged and skipped, never fatal.
 */
export async function runHourlyJobs(deps: Deps): Promise<void> {
  const now = deps.now();
  let backedUp = false;
  for (const user of deps.users.list()) {
    await yieldToRequests();
    // The account may have been deleted while this run yielded.
    if (!deps.users.find(user.id)) continue;
    try {
      if (runJobsFor(deps, user, now).includes("nightly-backup")) backedUp = true;
    } catch (error) {
      log("error", "user jobs failed", {
        user: userTag(user.id, deps.env.JWT_SECRET),
        ...errorFields(error),
      });
    }
  }
  deps.users.sweep();
  // One off-site copy per tick that wrote backups, after every user's are done.
  if (backedUp) await copyBackupsOffsite(deps.env);
}

/**
 * In-process jobs (croner). pm2 runs exactly one instance, so each job runs once.
 * One run shortly after start catches up on anything missed while it was down.
 */
export function startJobs(deps: Deps, options: { catchUpMs?: number } = {}): () => void {
  // Never two runs at once, whether started by the clock or by the catch-up.
  let running: Promise<void> | null = null;
  const tick = () => {
    // Nobody awaits a tick, so a failure must end here: Bun exits on an unhandled rejection.
    running ??= runHourlyJobs(deps)
      .catch((error) => log("error", "job run failed", errorFields(error)))
      .finally(() => {
        running = null;
      });
    return running;
  };
  const job = new Cron("5 * * * *", { name: "per-user-jobs" }, tick);
  const catchUp = setTimeout(() => void tick(), options.catchUpMs ?? 10_000);
  return () => {
    job.stop();
    clearTimeout(catchUp);
  };
}
