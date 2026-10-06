import { syncQuerySchema } from "@tick-taka/shared/schemas/common";
import { asc, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { ALL_TABLES, SYNC_TABLES, type SyncTableName } from "../../db/tables";
import type { Deps } from "../../lib/deps";
import { unauthorized } from "../../lib/errors";
import { currentScope } from "../../lib/user-scope";
import { validate } from "../../lib/validate";

type SyncTable = (typeof SYNC_TABLES)[SyncTableName];
const syncTables = () => Object.entries(SYNC_TABLES) as [SyncTableName, SyncTable][];
/** Internal flags (settings keys starting with "_") stay on the server. */
const visible = (name: SyncTableName, rows: unknown[]) =>
  name === "settings"
    ? rows.filter((row) => !String((row as { key: string }).key).startsWith("_"))
    : rows;

/**
 * Records updated since a timestamp (including deletions), oldest change first and
 * at most `limit` per table; `more` says some table had more than that. The phone
 * uses it to learn what the assistant changed while its stream was down. Busy tables
 * are indexed on updated_at.
 */
export function changesSince(deps: Deps, since: number, limit = 500) {
  // Taken before reading so nothing written during the read is skipped next time.
  const serverTime = deps.now();
  const changes = {} as Record<SyncTableName, unknown[]>;
  let more = false;
  for (const [name, table] of syncTables()) {
    const rows = deps.db
      .select()
      .from(table)
      .where(gt(table.updatedAt, since))
      .orderBy(asc(table.updatedAt))
      .limit(limit + 1)
      .all();
    if (rows.length > limit) more = true;
    changes[name] = visible(name, rows.slice(0, limit));
  }
  return { serverTime, changes, more };
}

/**
 * How many records in each table changed since a timestamp, without the rows: all
 * the phone needs to know which screens to refresh.
 */
export function changeCounts(deps: Deps, since: number) {
  const serverTime = deps.now();
  const counts = {} as Record<SyncTableName, number>;
  for (const [name, table] of syncTables()) {
    counts[name] =
      name === "settings"
        ? visible(name, deps.db.select().from(table).where(gt(table.updatedAt, since)).all()).length
        : (deps.db
            .select({ n: sql<number>`count(*)` })
            .from(table)
            .where(gt(table.updatedAt, since))
            .get()?.n ?? 0);
  }
  return { serverTime, counts };
}

export const syncRoutes = (deps: Deps) =>
  new Hono().get("/changes", validate("query", syncQuerySchema), (c) => {
    const { since, limit, summary } = c.req.valid("query");
    return c.json(
      summary
        ? { ...changeCounts(deps, since), changes: {}, more: false }
        : changesSince(deps, since, limit),
    );
  });

export const EXPORT_VERSION = 1;
/** Rows read and written per step, so a long history never sits in memory at once. */
const EXPORT_PAGE = 500;

/**
 * The full JSON export, `{ app, version, exportedAt, tables: { name: rows[] } }`,
 * streamed table by table and page by page instead of built in memory.
 */
export const exportRoutes = (deps: Deps) =>
  new Hono().get("/", (c) => {
    const scope = currentScope();
    if (!scope) throw unauthorized();
    // The body is written after this handler returns: hold the database open until then.
    const lease = deps.users.lease(scope.user);
    const { db } = lease.data;
    const exportedAt = deps.now();
    const stamp = new Date(exportedAt).toISOString().slice(0, 10);
    c.header("content-type", "application/json; charset=utf-8");
    c.header("content-disposition", `attachment; filename="tick-taka-export-${stamp}.json"`);
    return stream(c, async (out) => {
      try {
        await out.write(
          `{"app":"tick-taka","version":${EXPORT_VERSION},"exportedAt":${exportedAt},"tables":{`,
        );
        let firstTable = true;
        for (const [name, table] of Object.entries(ALL_TABLES)) {
          await out.write(`${firstTable ? "" : ","}${JSON.stringify(name)}:[`);
          firstTable = false;
          for (let offset = 0; ; offset += EXPORT_PAGE) {
            const rows = db
              .select()
              .from(table)
              .orderBy(sql`rowid`)
              .limit(EXPORT_PAGE)
              .offset(offset)
              .all();
            if (rows.length)
              await out.write(
                `${offset === 0 ? "" : ","}${rows.map((row) => JSON.stringify(row)).join(",")}`,
              );
            if (rows.length < EXPORT_PAGE) break;
          }
          await out.write("]");
        }
        await out.write("}}");
      } finally {
        lease.release();
      }
    });
  });
