import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { ALL_TABLES } from "../../db/tables";
import type { Deps } from "../../lib/deps";
import { unauthorized } from "../../lib/errors";
import { currentScope } from "../../lib/user-scope";

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
