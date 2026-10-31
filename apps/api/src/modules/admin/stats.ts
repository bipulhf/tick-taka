import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, statfsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  addMonths,
  DAY_MS,
  type LocalMonth,
  localMonthRange,
  toLocalMonth,
} from "@tick-taka/shared/dates";
import type { User } from "../../db/user-registry";
import type { Deps } from "../../lib/deps";
import { requestMetrics, startedAt } from "../../lib/metrics";
import { isOwner } from "../../lib/owner";
import { userTime } from "../../lib/user-time";

/**
 * What the owner's dashboard shows. Account facts and counts only: who signed up and
 * when, how active they are, what AI cost, how much they store and how many records
 * of each kind they keep. Never the content of anyone's records.
 */

const BACKUP_JOB = "nightly-backup";

/** Bytes in a file or, recursively, a folder; 0 when it isn't there. */
function sizeOf(path: string): number {
  if (path === ":memory:" || !existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const name of readdirSync(path)) total += sizeOf(join(path, name));
  return total;
}

function storageOf(deps: Deps, user: User) {
  const paths = deps.users.paths(user);
  const database = ["", "-wal", "-shm"].reduce((sum, s) => sum + sizeOf(`${paths.db}${s}`), 0);
  // The owner's inherited folders also hold everyone else's users/ folders.
  const uploads = user.legacy ? 0 : sizeOf(paths.uploads);
  const backups = user.legacy ? 0 : sizeOf(paths.backups);
  return { database, uploads, backups, total: database + uploads + backups };
}

/** When the user was last active: their sessions, or their last sign-in. */
function lastActive(user: User, activity: Map<string, { lastUsedAt: number }>): number {
  return Math.max(user.lastSeenAt, activity.get(user.id)?.lastUsedAt ?? 0);
}

export function adminUsers(deps: Deps) {
  const { timeZone, now } = userTime(deps);
  const month = toLocalMonth(now, timeZone);
  const activity = deps.users.sessions.activityByUser();
  const controls = deps.users.admin.allControls();
  const ai = deps.users.usageTotals.forMonth(month);
  return deps.users
    .list()
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      isOwner: isOwner(deps.env, user),
      createdAt: user.createdAt,
      lastActiveAt: lastActive(user, activity),
      liveSessions: activity.get(user.id)?.liveSessions ?? 0,
      blocked: controls.get(user.id)?.blocked ?? false,
      aiDisabled: controls.get(user.id)?.aiDisabled ?? false,
      aiCapMicros: controls.get(user.id)?.aiCapMicros ?? null,
      aiThisMonth: {
        calls: ai.get(user.id)?.calls ?? 0,
        costMicros: ai.get(user.id)?.costMicros ?? 0,
      },
      storage: storageOf(deps, user),
      lastBackup: deps.users.jobRuns.lastDate(user.id, BACKUP_JOB) ?? null,
    }))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export function adminOverview(deps: Deps) {
  const { timeZone, now } = userTime(deps);
  const users = deps.users.list();
  const activity = deps.users.sessions.activityByUser();
  const activeWithin = (days: number) =>
    users.filter((u) => lastActive(u, activity) >= now - days * DAY_MS).length;
  // Sign-ups in each of the last 12 weeks, oldest first, ending today.
  const signupsByWeek = Array.from({ length: 12 }, (_, i) => {
    const to = now - (11 - i) * 7 * DAY_MS;
    const from = to - 7 * DAY_MS;
    return {
      weekEnding: to,
      count: users.filter((u) => u.createdAt > from && u.createdAt <= to).length,
    };
  });
  const thisMonth = toLocalMonth(now, timeZone);
  const aiByMonth = Array.from({ length: 6 }, (_, i) => {
    const month = addMonths(thisMonth, i - 5);
    let costMicros = 0;
    let calls = 0;
    for (const totals of deps.users.usageTotals.forMonth(month).values()) {
      costMicros += totals.costMicros;
      calls += totals.calls;
    }
    return { month, costMicros, calls };
  });
  return {
    users: users.length,
    newLast7Days: users.filter((u) => u.createdAt >= now - 7 * DAY_MS).length,
    newLast30Days: users.filter((u) => u.createdAt >= now - 30 * DAY_MS).length,
    activeToday: activeWithin(1),
    active7Days: activeWithin(7),
    active30Days: activeWithin(30),
    liveSessions: [...activity.values()].reduce((sum, a) => sum + a.liveSessions, 0),
    signupsByWeek,
    aiByMonth,
    signupMode: deps.users.admin.signupMode(),
  };
}

/** Kinds of record counted per user, with the label the dashboard shows. */
const COUNTED = [
  ["tasks", "Tasks"],
  ["projects", "Projects"],
  ["habits", "Habits"],
  ["habit_logs", "Habit check-ins"],
  ["time_entries", "Time entries"],
  ["routines", "Routines"],
  ["transactions", "Transactions"],
  ["accounts", "Accounts"],
  ["budgets", "Budget lines"],
  ["recurring", "Bills and income"],
  ["goals", "Goals"],
  ["debts", "Debts"],
  ["events", "Events"],
  ["shopping_items", "Shopping items"],
] as const;

type Kind = (typeof COUNTED)[number][0];

/** Live rows (not deleted) in a table, and how many were made in the last 30 days. */
function countRows(sqlite: Database, table: string, since: number) {
  try {
    const row = sqlite
      .query<{ total: number; recent: number }, [number]>(
        `SELECT count(*) AS total, sum(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS recent
         FROM "${table}" WHERE deleted_at IS NULL`,
      )
      .get(since);
    return { total: row?.total ?? 0, recent: row?.recent ?? 0 };
  } catch {
    return { total: 0, recent: 0 };
  }
}

let usageCache: { at: number; value: ReturnType<typeof computeUsage> } | null = null;
const USAGE_CACHE_MS = 60_000;

function computeUsage(deps: Deps) {
  const { now } = userTime(deps);
  const since = now - 30 * DAY_MS;
  const perUser = deps.users.list().map((user) => {
    const counts = {} as Record<Kind, { total: number; recent: number }>;
    const lease = deps.users.lease(user);
    try {
      for (const [table] of COUNTED) counts[table] = countRows(lease.data.sqlite, table, since);
    } finally {
      // Opened just to count: close it again so the dashboard doesn't keep every user open.
      lease.release({ closeIfOpened: true });
    }
    return { id: user.id, email: user.email, name: user.name, counts };
  });
  const totals = COUNTED.map(([table, label]) => ({
    kind: table,
    label,
    total: perUser.reduce((sum, u) => sum + u.counts[table].total, 0),
    last30Days: perUser.reduce((sum, u) => sum + u.counts[table].recent, 0),
    users: perUser.filter((u) => u.counts[table].total > 0).length,
  }));
  return {
    computedAt: now,
    totals,
    perUser: perUser.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      counts: Object.fromEntries(COUNTED.map(([t]) => [t, u.counts[t].total])) as Record<
        Kind,
        number
      >,
      last30Days: COUNTED.reduce((sum, [t]) => sum + u.counts[t].recent, 0),
    })),
  };
}

/** Record counts across every user; opening each database, so cached for a minute. */
export function adminUsage(deps: Deps) {
  const now = Date.now();
  if (!usageCache || now - usageCache.at > USAGE_CACHE_MS)
    usageCache = { at: now, value: computeUsage(deps) };
  return usageCache.value;
}

/** One month's AI cost: per user from users.db, per feature from each user's own log. */
export function adminAi(deps: Deps, month?: LocalMonth) {
  const { timeZone, now } = userTime(deps);
  const selected = month ?? toLocalMonth(now, timeZone);
  const range = localMonthRange(selected, timeZone);
  const totals = deps.users.usageTotals.forMonth(selected);
  const users = deps.users.list();
  const byFeature = new Map<string, { feature: string; calls: number; costMicros: number }>();
  let inputTokens = 0;
  let outputTokens = 0;
  for (const user of users) {
    if (!totals.get(user.id)?.calls) continue;
    const lease = deps.users.lease(user);
    try {
      const rows = lease.data.sqlite
        .query<
          { feature: string; calls: number; cost: number; input: number; output: number },
          [number, number]
        >(
          `SELECT feature, count(*) AS calls, sum(cost_micros) AS cost,
             sum(input_tokens) AS input, sum(output_tokens) AS output
           FROM ai_usage WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
           GROUP BY feature`,
        )
        .all(range.from, range.to);
      for (const row of rows) {
        const sum = byFeature.get(row.feature) ?? { feature: row.feature, calls: 0, costMicros: 0 };
        sum.calls += row.calls;
        sum.costMicros += row.cost ?? 0;
        byFeature.set(row.feature, sum);
        inputTokens += row.input ?? 0;
        outputTokens += row.output ?? 0;
      }
    } finally {
      lease.release({ closeIfOpened: true });
    }
  }
  const byUser = users
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      calls: totals.get(user.id)?.calls ?? 0,
      costMicros: totals.get(user.id)?.costMicros ?? 0,
    }))
    .filter((u) => u.calls > 0)
    .sort((a, b) => b.costMicros - a.costMicros);
  return {
    month: selected,
    costMicros: byUser.reduce((sum, u) => sum + u.costMicros, 0),
    calls: byUser.reduce((sum, u) => sum + u.calls, 0),
    inputTokens,
    outputTokens,
    byUser,
    byFeature: [...byFeature.values()].sort((a, b) => b.costMicros - a.costMicros),
    serverCapMicros: deps.env.AI_USER_MONTHLY_CAP_MICROS || null,
    configured: deps.ai !== null,
  };
}

/** The process, the disk and the nightly backups. */
export function adminHealth(deps: Deps) {
  const { env } = deps;
  const dataDir = env.USERS_DB_PATH === ":memory:" ? process.cwd() : dirname(env.USERS_DB_PATH);
  let disk: { total: number; free: number } | null = null;
  try {
    const stat = statfsSync(dataDir);
    disk = { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize };
  } catch {
    disk = null;
  }
  const memory = process.memoryUsage();
  const users = deps.users.list();
  const today = Date.now();
  return {
    startedAt,
    uptimeMs: today - startedAt,
    runtime: `Bun ${Bun.version}`,
    memory: { rss: memory.rss, heapUsed: memory.heapUsed },
    disk,
    sizes: {
      registry: sizeOf(env.USERS_DB_PATH),
      userDatabases:
        sizeOf(env.USER_DATA_DIR) + (users.some((u) => u.legacy) ? sizeOf(env.DB_PATH) : 0),
      uploads: sizeOf(env.UPLOADS_DIR),
      backups: sizeOf(env.BACKUPS_DIR),
    },
    openDatabases: deps.users.openHandles,
    aiConfigured: deps.ai !== null,
    jobsEnabled: env.JOBS_ENABLED,
    offsiteBackups: Boolean(env.BACKUP_OFFSITE_CMD),
    requests: requestMetrics(),
    backups: users.map((user) => ({
      id: user.id,
      email: user.email,
      lastBackup: deps.users.jobRuns.lastDate(user.id, BACKUP_JOB) ?? null,
    })),
  };
}

/** One month's thumbs up and down on Tiki's replies, with the latest comments and who left them. */
export function adminFeedback(deps: Deps, month?: LocalMonth) {
  const { timeZone, now } = userTime(deps);
  const selected = month ?? toLocalMonth(now, timeZone);
  const range = localMonthRange(selected, timeZone);
  const { up, down, comments } = deps.users.feedback.between(range.from, range.to);
  const emails = new Map(deps.users.list().map((user) => [user.id, user.email]));
  return {
    month: selected,
    up,
    down,
    comments: comments.map(({ userId, ...comment }) => ({
      ...comment,
      email: emails.get(userId) ?? null,
    })),
  };
}
