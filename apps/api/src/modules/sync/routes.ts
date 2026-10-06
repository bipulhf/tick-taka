import { syncQuerySchema } from "@tick-taka/shared/schemas/common";
import { gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { ALL_TABLES, SYNC_TABLES, type SyncTableName } from "../../db/tables";
import type { Deps } from "../../lib/deps";
import { unauthorized } from "../../lib/errors";
import { currentScope } from "../../lib/user-scope";
import { validate } from "../../lib/validate";

/**
 * Every record updated since a timestamp (including deletions). The phone uses it to
 * learn what the assistant changed while its stream was down, and to refresh only
 * the screens whose data moved. Busy tables are indexed on updated_at.
 */
export function changesSince(deps: Deps, since: number) {
  // Taken before reading so nothing written during the read is skipped next time.
  const serverTime = deps.now();
  const changes = {} as Record<SyncTableName, unknown[]>;
  for (const [name, table] of Object.entries(SYNC_TABLES) as [
    SyncTableName,
    (typeof SYNC_TABLES)[SyncTableName],
  ][]) {
    const rows = deps.db.select().from(table).where(gt(table.updatedAt, since)).all();
    // Internal flags (keys starting with "_") stay on the server.
    changes[name] =
      name === "settings"
        ? rows.filter((row) => !String((row as { key: string }).key).startsWith("_"))
        : rows;
  }
  return { serverTime, changes };
}

export const syncRoutes = (deps: Deps) =>
  new Hono().get("/changes", validate("query", syncQuerySchema), (c) =>
    c.json(changesSince(deps, c.req.valid("query").since)),
  );

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
