import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { RECEIPT_GRACE_MS, sweepReceipts } from "../src/jobs/receipt-sweep";
import { runHourlyJobs } from "../src/jobs/scheduler";
import { createTestContext, type TestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const DAY = 24 * 60 * 60 * 1000;
/** 4:05 am in Dhaka, when the receipt sweep is due. */
const SWEEP_TIME = zonedTimeToUtc(
  { year: 2026, month: 10, day: 4, hour: 4, minute: 5 },
  "Asia/Dhaka",
);

async function upload(ctx: TestContext): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.jpg", { type: "image/jpeg" }),
  );
  const res = await ctx.app.request("/uploads", {
    method: "POST",
    body: form,
    headers: { authorization: `Bearer ${ctx.token}` },
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { path: string }).path;
}

/** Makes a file look as if it was written `ageMs` before `now`. */
function age(path: string, now: number, ageMs: number) {
  const at = (now - ageMs) / 1000;
  utimesSync(path, at, at);
}

async function context() {
  const dir = mkdtempSync(join(tmpdir(), "tt-receipts-"));
  const ctx = await createTestContext({ now: SWEEP_TIME, env: { UPLOADS_DIR: dir } });
  return { ctx, uploads: ctx.deps.uploadsDir };
}

describe("receipt sweep", () => {
  test("removes old files no transaction points to and keeps the rest", async () => {
    const { ctx, uploads } = await context();
    const { cash, category } = await setupMoney(ctx);
    const expense = (receiptPath: string) =>
      ctx.request<Row>("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        categoryId: category("Food").id,
        amountMinor: 10_000,
        occurredAt: SWEEP_TIME,
        receiptPath,
      });
    const attached = await upload(ctx);
    await expense(attached);
    const undoable = await upload(ctx);
    const deleted = (await expense(undoable)).body;
    expect((await ctx.request("DELETE", `/transactions/${deleted.id}`)).status).toBe(200);
    const orphan = await upload(ctx);
    const fresh = await upload(ctx);
    for (const name of [attached, undoable, orphan]) age(join(uploads, name), SWEEP_TIME, 8 * DAY);
    age(join(uploads, fresh), SWEEP_TIME, DAY);

    expect(sweepReceipts(ctx.deps.db, uploads, SWEEP_TIME)).toEqual({ removed: 1 });
    expect(existsSync(join(uploads, orphan))).toBe(false);
    expect(existsSync(join(uploads, attached))).toBe(true);
    // A deleted transaction can be restored, so its photo stays.
    expect(existsSync(join(uploads, undoable))).toBe(true);
    // A photo just picked may still be on its way to a transaction.
    expect(existsSync(join(uploads, fresh))).toBe(true);
  });

  test("a receipt replaced on edit is removed once the grace period passes", async () => {
    const { ctx, uploads } = await context();
    const { cash } = await setupMoney(ctx);
    const first = await upload(ctx);
    const tx = (
      await ctx.request<Row>("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor: 5_000,
        occurredAt: SWEEP_TIME,
        receiptPath: first,
      })
    ).body;
    const second = await upload(ctx);
    await ctx.request("PATCH", `/transactions/${tx.id}`, { receiptPath: second });
    age(join(uploads, first), SWEEP_TIME, RECEIPT_GRACE_MS + 1);
    age(join(uploads, second), SWEEP_TIME, RECEIPT_GRACE_MS + 1);
    expect(sweepReceipts(ctx.deps.db, uploads, SWEEP_TIME)).toEqual({ removed: 1 });
    expect(existsSync(join(uploads, first))).toBe(false);
    expect(existsSync(join(uploads, second))).toBe(true);
  });

  test("only receipt-named files directly in the folder are touched", async () => {
    const { ctx, uploads } = await context();
    mkdirSync(join(uploads, "users", "someone"), { recursive: true });
    const nested = join(uploads, "users", "someone", "01JZ0000000000000000000000.jpg");
    const other = join(uploads, "notes.txt");
    writeFileSync(nested, "x");
    writeFileSync(other, "x");
    for (const path of [nested, other]) age(path, SWEEP_TIME, 30 * DAY);
    expect(sweepReceipts(ctx.deps.db, uploads, SWEEP_TIME)).toEqual({ removed: 0 });
    expect(existsSync(nested)).toBe(true);
    expect(existsSync(other)).toBe(true);
  });

  test("a missing uploads folder is fine", async () => {
    const { ctx } = await context();
    expect(sweepReceipts(ctx.deps.db, join(tmpdir(), "tt-no-such-dir"), SWEEP_TIME)).toEqual({
      removed: 0,
    });
  });

  test("runs once a day from the nightly jobs", async () => {
    const { ctx, uploads } = await context();
    const orphan = await upload(ctx);
    age(join(uploads, orphan), SWEEP_TIME, 8 * DAY);
    await runHourlyJobs(ctx.deps);
    expect(existsSync(join(uploads, orphan))).toBe(false);
    const [user] = ctx.deps.users.list();
    expect(ctx.deps.users.jobRuns.lastDate(user!.id, "receipt-sweep")).toBe("2026-10-04");
  });
});
