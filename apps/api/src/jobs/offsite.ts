import type { Env } from "../env";
import { log } from "../lib/log";

/** Long enough for an rsync of every user's backups over a slow link. */
const OFFSITE_TIMEOUT_MS = 10 * 60_000;

/**
 * Runs BACKUP_OFFSITE_CMD (if set) through `sh -c`, with BACKUPS_DIR in its
 * environment, and logs how it went. Never throws: a failed copy must not stop the
 * jobs, and the next night's run tries again with everything.
 */
export async function copyBackupsOffsite(
  env: Pick<Env, "BACKUP_OFFSITE_CMD" | "BACKUPS_DIR">,
  timeoutMs = OFFSITE_TIMEOUT_MS,
): Promise<void> {
  const command = env.BACKUP_OFFSITE_CMD;
  if (!command) return;
  const started = Date.now();
  try {
    const child = Bun.spawn(["sh", "-c", command], {
      env: { ...process.env, BACKUPS_DIR: env.BACKUPS_DIR },
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    const ms = Date.now() - started;
    if (code === 0) log("info", "offsite backup copied", { ms });
    else
      log("error", "offsite backup failed", {
        code,
        signal: child.signalCode,
        ms,
        stderr: stderr.slice(-500),
      });
  } catch (error) {
    log("error", "offsite backup failed", { message: (error as Error).message });
  }
}
