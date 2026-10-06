import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/db/client";
import { seedDefaults } from "../src/db/seed";
import { runBackup } from "../src/jobs/backup";
import { createTestContext, googleToken, type TestContext } from "./helpers";

const as = (token: string) => ({ authorization: `Bearer ${token}` });

function dataDir() {
  const dir = mkdtempSync(join(tmpdir(), "tt-account-"));
  return {
    dir,
    env: {
      DB_PATH: join(dir, "app.db"),
      UPLOADS_DIR: join(dir, "uploads"),
      BACKUPS_DIR: join(dir, "backups"),
    },
  };
}

async function uploadReceipt(ctx: TestContext, token: string) {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.jpg", { type: "image/jpeg" }),
  );
  const res = await ctx.app.request("/uploads", { method: "POST", body: form, headers: as(token) });
  expect(res.status).toBe(201);
}

const deleteAccount = (ctx: TestContext, token: string) =>
  ctx.app.request("/auth/account", { method: "DELETE", headers: as(token) });

describe("deleting an account", () => {
  test("removes the user, their sessions, database, receipts and backups", async () => {
    const { dir, env } = dataDir();
    const ctx = await createTestContext({ now: Date.now(), env });
    const keep = await ctx.tokenFor("sub-keep", "keep@example.com");
    const [me, other] = ctx.deps.users.list();
    await uploadReceipt(ctx, ctx.token);
    await uploadReceipt(ctx, keep);
    for (const user of [me!, other!]) {
      const data = ctx.deps.users.data(user);
      runBackup(data.sqlite, data.backupsDir, Date.now(), "Asia/Dhaka");
    }
    const mine = {
      db: join(dir, "users", `${me!.id}.db`),
      uploads: join(dir, "uploads", "users", me!.id),
      backups: join(dir, "backups", "users", me!.id),
    };
    for (const path of Object.values(mine)) expect(existsSync(path)).toBe(true);

    expect((await deleteAccount(ctx, ctx.token)).status).toBe(204);

    for (const path of Object.values(mine)) expect(existsSync(path)).toBe(false);
    expect(existsSync(`${mine.db}-wal`)).toBe(false);
    expect(ctx.deps.users.find(me!.id)).toBeUndefined();
    expect((await ctx.app.request("/settings", { headers: as(ctx.token) })).status).toBe(401);

    // Everyone else is untouched.
    expect(existsSync(join(dir, "users", `${other!.id}.db`))).toBe(true);
    expect(readdirSync(join(dir, "uploads", "users", other!.id))).toHaveLength(1);
    expect(readdirSync(join(dir, "backups", "users", other!.id))).toHaveLength(1);
    expect((await ctx.app.request("/settings", { headers: as(keep) })).status).toBe(200);

    // Signing in again with the same Google account starts a fresh account.
    const again = await ctx.app.request("/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: googleToken("test-user", "test@example.com") }),
    });
    expect(((await again.json()) as { created: boolean }).created).toBe(true);
  });

  test("for the owner's inherited data, leaves other users' folders alone", async () => {
    const { dir, env } = dataDir();
    const legacy = openDatabase(env.DB_PATH);
    seedDefaults(legacy.db, Date.now());
    legacy.sqlite.close();
    mkdirSync(env.BACKUPS_DIR, { recursive: true });
    writeFileSync(join(env.BACKUPS_DIR, "app-2026-10-01.db"), "old");
    writeFileSync(join(env.BACKUPS_DIR, "notes.txt"), "not a backup");

    const ctx = await createTestContext({
      now: Date.now(),
      env: { ...env, OWNER_EMAIL: "owner@example.com" },
    });
    const owner = await ctx.tokenFor("sub-owner", "owner@example.com");
    const [someone, ownerUser] = ctx.deps.users.list();
    expect(ownerUser!.legacy).toBe(true);
    await uploadReceipt(ctx, owner);
    await uploadReceipt(ctx, ctx.token);
    expect(readdirSync(env.UPLOADS_DIR).filter((f) => f.endsWith(".jpg"))).toHaveLength(1);

    expect((await deleteAccount(ctx, owner)).status).toBe(204);

    expect(existsSync(env.DB_PATH)).toBe(false);
    expect(readdirSync(env.UPLOADS_DIR)).toEqual(["users"]);
    expect(readdirSync(env.BACKUPS_DIR)).toEqual(["notes.txt"]);
    expect(readdirSync(join(dir, "uploads", "users", someone!.id))).toHaveLength(1);
    expect(existsSync(join(dir, "users", `${someone!.id}.db`))).toBe(true);
    expect((await ctx.app.request("/settings", { headers: as(ctx.token) })).status).toBe(200);
  });

  test("needs a signed-in session", async () => {
    const ctx = await createTestContext();
    const res = await ctx.app.request("/auth/account", { method: "DELETE" });
    expect(res.status).toBe(401);
    expect(ctx.deps.users.list()).toHaveLength(1);
  });
});
