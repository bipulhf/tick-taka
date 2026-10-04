import { syncQuerySchema } from "@tick-taka/shared/schemas/common";
import { gt } from "drizzle-orm";
import { Hono } from "hono";
import { ALL_TABLES, SYNC_TABLES, type SyncTableName } from "../../db/tables";
import type { Deps } from "../../lib/deps";
import { validate } from "../../lib/validate";

export const EXPORT_VERSION = 1;

/** Every record updated since a timestamp (including deletions) for the offline cache. */
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

export const exportRoutes = (deps: Deps) =>
  new Hono().get("/", (c) => {
    const tables = Object.fromEntries(
      Object.entries(ALL_TABLES).map(([name, table]) => [name, deps.db.select().from(table).all()]),
    );
    const exportedAt = deps.now();
    const stamp = new Date(exportedAt).toISOString().slice(0, 10);
    c.header("content-disposition", `attachment; filename="tick-taka-export-${stamp}.json"`);
    return c.json({ app: "tick-taka", version: EXPORT_VERSION, exportedAt, tables });
  });
