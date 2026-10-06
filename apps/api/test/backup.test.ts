import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupsShareDisk, checkBackup, runBackup } from "../src/jobs/backup";

const NOW = Date.UTC(2026, 9, 4, 0, 0);

function liveDb() {
  const db = new Database(":memory:");
  db.exec("create table t (id integer primary key, note text)");
  db.exec("insert into t (note) values ('a'), ('b')");
  return db;
}

describe("nightly backups", () => {
  test("write a checked copy and keep the newest 14", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-backup-"));
    for (let day = 1; day <= 20; day++)
      writeFileSync(join(dir, `app-2026-09-${String(day).padStart(2, "0")}.db`), "");
    const path = runBackup(liveDb(), dir, NOW, "Asia/Dhaka");
    expect(path).toBe(join(dir, "app-2026-10-04.db"));
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(14);
    expect(files.at(-1)).toBe("app-2026-10-04.db");
    expect(files.some((f) => f.endsWith(".partial"))).toBe(false);
    const copy = new Database(path, { readonly: true });
    expect(copy.query("select count(*) as n from t").get()).toEqual({ n: 2 });
    copy.close();
  });

  test("the integrity check refuses a damaged file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-backup-"));
    const bad = join(dir, "app-2026-10-04.db");
    writeFileSync(bad, "this is not a database at all, just text that is long enough");
    expect(() => checkBackup(bad)).toThrow();
  });

  test("tell when backups share the live data's disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-backup-"));
    expect(backupsShareDisk(join(dir, "users"), join(dir, "backups"))).toBe(true);
    expect(backupsShareDisk(":memory:", join(dir, "backups"))).toBe(false);
  });
});
