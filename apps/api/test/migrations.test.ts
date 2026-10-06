import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { newId } from "@tick-taka/shared/ids";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDatabase } from "../src/db/client";
import { seedDefaults } from "../src/db/seed";

const MIGRATIONS = fileURLToPath(new URL("../drizzle", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "tick-taka-migrations-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** A copy of the migrations folder that stops after `lastTag`. */
function migrationsUpTo(lastTag: string): string {
  const folder = join(work, `upto-${lastTag}`);
  mkdirSync(join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  const last = journal.entries.findIndex((entry) => entry.tag === lastTag);
  journal.entries = journal.entries.slice(0, last + 1);
  for (const entry of journal.entries)
    copyFileSync(join(MIGRATIONS, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  return folder;
}

const count = (sqlite: Database, table: string) =>
  (sqlite.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("0004_constraints on a populated database", () => {
  test("keeps every row, links and indexes, and enforces the new constraints", () => {
    const path = join(work, "user.db");
    const before = new Database(path, { create: true });
    before.exec("PRAGMA foreign_keys = ON;");
    migrate(drizzle({ client: before }), { migrationsFolder: migrationsUpTo("0003_task_next_id") });
    const now = Date.UTC(2026, 9, 4, 4);
    seedDefaults(drizzle({ client: before }), now);

    const stamp = `${now}, ${now}, NULL`;
    const area = (before.query("SELECT id FROM areas LIMIT 1").get() as { id: string }).id;
    const food = (
      before
        .query("SELECT id FROM categories WHERE parent_id IS NULL AND kind = 'expense'")
        .get() as {
        id: string;
      }
    ).id;
    const [cash, goal, parent, child, orphan, entry, tx, budget, recurringId] = Array.from(
      { length: 9 },
      () => newId(),
    );
    before.exec(`
      INSERT INTO accounts (id, created_at, updated_at, deleted_at, name, type, currency, opening_minor, sort)
        VALUES ('${cash}', ${stamp}, 'Cash', 'cash', 'BDT', 500000, 0);
      INSERT INTO goals (id, created_at, updated_at, deleted_at, name, emoji, target_minor, deadline, account_id, create_tasks)
        VALUES ('${goal}', ${stamp}, 'Laptop', '💻', 9000000, '2027-01-31', NULL, 1);
      INSERT INTO tasks (id, created_at, updated_at, deleted_at, area_id, title, status, priority, has_time, when_slot, urgent, sort, goal_id, top3_date)
        VALUES ('${parent}', ${stamp}, '${area}', 'Move flat', 'open', 'high', 0, 'day', 0, 0, '${goal}', '2026-10-04');
      INSERT INTO tasks (id, created_at, updated_at, deleted_at, parent_id, title, status, priority, has_time, when_slot, urgent, sort)
        VALUES ('${child}', ${stamp}, '${parent}', 'Pack', 'done', 'normal', 0, 'day', 0, 0);
      INSERT INTO tasks (id, created_at, updated_at, deleted_at, parent_id, title, status, priority, has_time, when_slot, urgent, sort, goal_id)
        VALUES ('${orphan}', ${stamp}, '${newId()}', 'Lost subtask', 'inbox', 'low', 0, 'evening', 0, 0, '${newId()}');
      INSERT INTO time_entries (id, created_at, updated_at, deleted_at, task_id, area_id, started_at, ended_at, source, billable)
        VALUES ('${entry}', ${stamp}, '${parent}', '${area}', ${now - 3_600_000}, ${now}, 'focus', 0);
      INSERT INTO recurring (id, created_at, updated_at, deleted_at, kind, name, amount_minor, currency, account_id, category_id, rrule, next_due_at, remind_days, active)
        VALUES ('${recurringId}', ${stamp}, 'bill', 'Internet', 120000, 'BDT', '${cash}', '${food}', 'FREQ=MONTHLY;BYMONTHDAY=5', ${now}, 2, 1);
      INSERT INTO transactions (id, created_at, updated_at, deleted_at, type, account_id, amount_minor, fee_minor, category_id, recurring_id, occurred_at)
        VALUES ('${tx}', ${stamp}, 'expense', '${cash}', 120000, 0, '${food}', '${recurringId}', ${now});
      INSERT INTO transactions (id, created_at, updated_at, deleted_at, type, account_id, amount_minor, fee_minor, occurred_at)
        VALUES ('${newId()}', ${stamp}, 'adjustment', '${cash}', -5000, 0, ${now});
      INSERT INTO budgets (id, created_at, updated_at, deleted_at, category_id, month, limit_minor, rollover)
        VALUES ('${budget}', ${stamp}, '${food}', '2026-10', 1200000, 1);
    `);
    const tables = [
      "areas",
      "categories",
      "accounts",
      "goals",
      "tasks",
      "time_entries",
      "recurring",
      "transactions",
      "budgets",
    ];
    const counts = Object.fromEntries(tables.map((t) => [t, count(before, t)]));
    before.close();

    const { sqlite } = openDatabase(path);
    expect(Object.fromEntries(tables.map((t) => [t, count(sqlite, t)]))).toEqual(counts);
    expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(sqlite.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(
      (sqlite.query("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys,
    ).toBe(1);
    // Links survive; links to rows that never existed are cleared.
    expect(sqlite.query(`SELECT parent_id FROM tasks WHERE id = '${child}'`).get()).toEqual({
      parent_id: parent,
    });
    expect(
      sqlite.query(`SELECT parent_id, goal_id FROM tasks WHERE id = '${orphan}'`).get(),
    ).toEqual({
      parent_id: null,
      goal_id: null,
    });
    expect(sqlite.query(`SELECT task_id FROM time_entries WHERE id = '${entry}'`).get()).toEqual({
      task_id: parent,
    });
    const indexes = sqlite
      .query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'tasks_parent_idx'")
      .all();
    expect(indexes).toHaveLength(1);

    // The database now refuses what only zod refused before.
    const rejects = (statement: string) => expect(() => sqlite.exec(statement)).toThrow();
    rejects(`UPDATE tasks SET status = 'later' WHERE id = '${parent}'`);
    rejects(`UPDATE tasks SET parent_id = '${newId()}' WHERE id = '${child}'`);
    rejects(`UPDATE tasks SET parent_id = id WHERE id = '${child}'`);
    rejects(`UPDATE tasks SET goal_id = '${newId()}' WHERE id = '${parent}'`);
    rejects(`UPDATE categories SET parent_id = '${newId()}' WHERE id = '${food}'`);
    rejects(`UPDATE transactions SET amount_minor = 0 WHERE id = '${tx}'`);
    rejects(`UPDATE transactions SET fee_minor = -1 WHERE id = '${tx}'`);
    rejects(`UPDATE time_entries SET ended_at = started_at - 1 WHERE id = '${entry}'`);
    rejects(`UPDATE budgets SET month = '2026/10' WHERE id = '${budget}'`);
    rejects(`DELETE FROM tasks WHERE id = '${parent}'`);
    sqlite.close();
  });

  test("repairs rows older builds let through instead of aborting", () => {
    const path = join(work, "legacy-rows.db");
    const before = new Database(path, { create: true });
    migrate(drizzle({ client: before }), { migrationsFolder: migrationsUpTo("0003_task_next_id") });
    const now = Date.UTC(2026, 9, 4, 4);
    seedDefaults(drizzle({ client: before }), now);
    const stamp = `${now}, ${now}, NULL`;
    const [cash, zeroSpend, deletedZero, trip, debt, habit, log, budget] = Array.from(
      { length: 8 },
      () => newId(),
    );
    before.exec(`
      INSERT INTO accounts (id, created_at, updated_at, deleted_at, name, type, currency, opening_minor, sort)
        VALUES ('${cash}', ${stamp}, 'Cash', 'cash', 'BDT', 500000, 0);
      INSERT INTO transactions (id, created_at, updated_at, deleted_at, type, account_id, amount_minor, fee_minor, occurred_at)
        VALUES ('${zeroSpend}', ${stamp}, 'expense', '${cash}', 0, 0, ${now});
      INSERT INTO transactions (id, created_at, updated_at, deleted_at, type, account_id, amount_minor, fee_minor, occurred_at)
        VALUES ('${deletedZero}', ${now}, ${now}, ${now}, 'expense', '${cash}', 0, -5, ${now});
      INSERT INTO events (id, created_at, updated_at, deleted_at, name, emoji, budget_minor, starts_on, ends_on)
        VALUES ('${trip}', ${stamp}, 'Trip', '✈️', -100, '2026-10-10', '2026-10-01');
      INSERT INTO debts (id, created_at, updated_at, deleted_at, person, direction, principal_minor)
        VALUES ('${debt}', ${stamp}, 'Rafi', 'i_owe', -2000);
      INSERT INTO habits (id, created_at, updated_at, deleted_at, name, emoji, color, schedule, per_week, target_count)
        VALUES ('${habit}', ${stamp}, 'Run', '🏃', 'green', 'n_per_week', 9, 0);
      INSERT INTO habit_logs (id, created_at, updated_at, deleted_at, habit_id, date, count)
        VALUES ('${log}', ${stamp}, '${habit}', '4 Oct', 1);
      INSERT INTO budgets (id, created_at, updated_at, deleted_at, category_id, month, limit_minor, rollover)
        VALUES ('${budget}', ${stamp}, (SELECT id FROM categories LIMIT 1), '2026-10', -1, 0);
    `);
    before.close();

    const { sqlite } = openDatabase(path);
    const row = (sql: string) => sqlite.query(sql).get();
    expect(row(`SELECT type, amount_minor FROM transactions WHERE id = '${zeroSpend}'`)).toEqual({
      type: "adjustment",
      amount_minor: 0,
    });
    expect(row(`SELECT fee_minor FROM transactions WHERE id = '${deletedZero}'`)).toEqual({
      fee_minor: 0,
    });
    expect(row(`SELECT budget_minor, starts_on, ends_on FROM events WHERE id = '${trip}'`)).toEqual(
      { budget_minor: null, starts_on: "2026-10-10", ends_on: "2026-10-10" },
    );
    expect(row(`SELECT principal_minor FROM debts WHERE id = '${debt}'`)).toEqual({
      principal_minor: 2000,
    });
    expect(row(`SELECT per_week, target_count FROM habits WHERE id = '${habit}'`)).toEqual({
      per_week: 7,
      target_count: 1,
    });
    expect(row(`SELECT id FROM habit_logs WHERE id = '${log}'`)).toBeNull();
    expect(row(`SELECT limit_minor FROM budgets WHERE id = '${budget}'`)).toEqual({
      limit_minor: 0,
    });
    sqlite.close();
  });
});
