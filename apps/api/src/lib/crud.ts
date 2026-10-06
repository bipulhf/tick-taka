import { newId } from "@tick-taka/shared/ids";
import { and, asc, eq, type InferSelectModel, isNull, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client";
import { notFound } from "./errors";

type SoftDeleteTable = SQLiteTable & {
  id: SQLiteColumn;
  createdAt: SQLiteColumn;
  updatedAt: SQLiteColumn;
  deletedAt: SQLiteColumn;
};

type SystemFields = "id" | "createdAt" | "updatedAt" | "deletedAt";

/** Omit that keeps optional modifiers on Drizzle's insert types (plain Omit drops them). */
type WithoutSystemFields<I> = { [K in keyof I as K extends SystemFields ? never : K]: I[K] };

export type CreateValues<T extends SoftDeleteTable> = WithoutSystemFields<T["$inferInsert"]> & {
  id?: string | undefined;
};

export type UpdateValues<T extends SoftDeleteTable> = Partial<
  WithoutSystemFields<T["$inferInsert"]>
> & {
  /** When the edit was made on the phone; older edits lose to newer rows (last write wins). */
  updatedAt?: number | undefined;
};

/**
 * Soft-delete CRUD shared by every simple resource. Creates are idempotent on the
 * client-generated id, so a retried offline write never duplicates a record.
 */
export function crud<T extends SoftDeleteTable>(
  db: Db,
  table: T,
  entity: string,
  now: () => number,
) {
  type Row = InferSelectModel<T>;
  const cols = table as SoftDeleteTable;
  // Drizzle's generic table types are too deep for TypeScript to follow here; the
  // public signatures above stay fully typed.
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  const t = table as any;

  const service = {
    list(where?: SQL, orderBy: SQL | SQLiteColumn = asc(cols.createdAt)): Row[] {
      return db
        .select()
        .from(t)
        .where(and(isNull(cols.deletedAt), where))
        .orderBy(orderBy)
        .all() as Row[];
    },

    find(id: string, includeDeleted = false): Row | undefined {
      return db
        .select()
        .from(t)
        .where(includeDeleted ? eq(cols.id, id) : and(eq(cols.id, id), isNull(cols.deletedAt)))
        .get() as Row | undefined;
    },

    get(id: string): Row {
      const row = service.find(id);
      if (!row) throw notFound(entity);
      return row;
    },

    create(values: CreateValues<T>): Row {
      const time = now();
      const id = values.id ?? newId(time);
      const existing = service.find(id, true);
      if (existing) return existing;
      db.insert(t)
        .values({ ...values, id, createdAt: time, updatedAt: time, deletedAt: null })
        .run();
      return service.find(id) as Row;
    },

    update(id: string, values: UpdateValues<T>): Row {
      const current = service.get(id) as Row & { updatedAt: number };
      const { updatedAt: editedAt, ...changes } = values;
      if (editedAt !== undefined && editedAt < current.updatedAt) return current;
      const clean = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      db.update(t)
        .set({ ...clean, updatedAt: Math.max(now(), current.updatedAt + 1) })
        .where(eq(cols.id, id))
        .run();
      return service.get(id);
    },

    /** Deleting an already-deleted row returns it unchanged, so a retried delete succeeds. */
    remove(id: string): Row {
      const row = service.find(id, true) as (Row & { deletedAt: number | null }) | undefined;
      if (!row) throw notFound(entity);
      if (row.deletedAt !== null) return row;
      const time = now();
      db.update(t).set({ deletedAt: time, updatedAt: time }).where(eq(cols.id, id)).run();
      return service.find(id, true) as Row;
    },

    /** Restoring a live row returns it unchanged, so a retried Undo succeeds. */
    restore(id: string): Row {
      const row = service.find(id, true) as (Row & { deletedAt: number | null }) | undefined;
      if (!row) throw notFound(entity);
      if (row.deletedAt === null) return row;
      db.update(t).set({ deletedAt: null, updatedAt: now() }).where(eq(cols.id, id)).run();
      return service.get(id);
    },
  };
  return service;
}
