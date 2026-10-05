import {
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsPatch,
  settingsSchema,
} from "@tick-taka/shared/schemas/settings";
import { inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { settings } from "../../db/schema/system";

/** Settings live one key per row; reads merge stored values over the defaults. */
export function readSettings(db: Db): Settings {
  const rows = db.select().from(settings).where(isNull(settings.deletedAt)).all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  if (parsed.success) return parsed.data;
  // A bad stored value must never lock the app out: fall back key by key.
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(stored)) {
    const field = settingsSchema.shape[key as keyof Settings];
    if (field?.safeParse(value).success) merged[key] = value;
  }
  return settingsSchema.parse(merged);
}

export function writeSettings(db: Db, patch: SettingsPatch, now: number): Settings {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length > 0) {
    db.transaction((tx) => {
      for (const [key, raw] of entries) {
        // The column is NOT NULL JSON; a cleared setting is stored as the JSON text `null`.
        const value = raw === null ? sql`'null'` : raw;
        tx.insert(settings)
          .values({ key, value, createdAt: now, updatedAt: now, deletedAt: null })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedAt: now, deletedAt: null },
          })
          .run();
      }
    });
  }
  return readSettings(db);
}

/** Internal flags (not user settings) share the table under a leading underscore. */
export function readFlag(db: Db, key: `_${string}`): unknown {
  return db
    .select()
    .from(settings)
    .where(inArray(settings.key, [key]))
    .get()?.value;
}

export function writeFlag(db: Db, key: `_${string}`, value: unknown, now: number): void {
  db.insert(settings)
    .values({ key, value, createdAt: now, updatedAt: now, deletedAt: null })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
}
