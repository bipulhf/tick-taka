import { describe, expect, test } from "bun:test";
import { HOUR_MS, MINUTE_MS, startOfLocalDay } from "@tick-taka/shared/dates";
import { createTestContext, DEFAULT_NOW } from "./helpers";

const TZ = "Asia/Dhaka";
type Row = Record<string, unknown> & { id: string; updatedAt: number };

/**
 * QA-203: offline, the user taps a bulk move and then renames one of the moved
 * tasks. Both replay hours later. The server stamps the move with the replay time,
 * so the phone must learn that stamp from the reply and lift the queued rename to
 * it (the outbox's followCreatedRecords), or last-write-wins drops the rename.
 */
describe("a bulk move, then an edit made after it", () => {
  test("rescue-overdue replies with each moved task's new stamp", async () => {
    const ctx = await createTestContext();
    const task = await ctx.request<Row>("POST", "/tasks", {
      title: "Call bank",
      status: "open",
      doAt: startOfLocalDay("2026-10-01", TZ),
    });
    const renamedAt = DEFAULT_NOW + MINUTE_MS; // the phone's tap time, offline
    ctx.clock.advance(2 * HOUR_MS); // replayed two hours later
    const moved = await ctx.request<{ moved: number; tasks: Row[] }>(
      "POST",
      "/tasks/rescue-overdue",
      { target: "today", date: "2026-10-04" },
    );
    expect(moved.body.moved).toBe(1);
    const stamped = moved.body.tasks.find((row) => row.id === task.body.id);
    expect(stamped?.updatedAt).toBe(DEFAULT_NOW + 2 * HOUR_MS);
    expect(stamped?.doAt).toBe(startOfLocalDay("2026-10-04", TZ));

    // As sent without lifting, the rename is older than the move and loses.
    const stale = await ctx.request<Row>("PATCH", `/tasks/${task.body.id}`, {
      title: "Call bank about card",
      updatedAt: renamedAt,
    });
    expect(stale.body.title).toBe("Call bank");
    // Lifted to the stamp from the reply, it wins.
    const lifted = await ctx.request<Row>("PATCH", `/tasks/${task.body.id}`, {
      title: "Call bank about card",
      updatedAt: Math.max(renamedAt, stamped!.updatedAt),
    });
    expect(lifted.body.title).toBe("Call bank about card");
  });

  test("move-low-priority lists the moved tasks with their new stamp", async () => {
    const ctx = await createTestContext();
    const today = startOfLocalDay("2026-10-04", TZ);
    const task = await ctx.request<Row>("POST", "/tasks", {
      title: "Low",
      status: "open",
      doAt: today,
      priority: "low",
      estimateMin: 60,
    });
    ctx.clock.advance(HOUR_MS);
    const res = await ctx.request<{ moved: Row[] }>("POST", "/tasks/move-low-priority", {
      date: "2026-10-04",
      minutesToFree: 30,
    });
    expect(res.body.moved.map((row) => [row.id, row.updatedAt])).toEqual([
      [task.body.id, DEFAULT_NOW + HOUR_MS],
    ]);
  });
});
