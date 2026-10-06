import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext } from "./helpers";

type Row = { id: string; startedAt: number; endedAt: number | null };
const MINUTE = 60_000;

describe("timer writes replayed from the offline queue", () => {
  test("start and stop sent hours later keep the times they were tapped", async () => {
    const ctx = await createTestContext();
    const tapStart = ctx.clock.now;
    const tapStop = tapStart + 45 * MINUTE;
    // The phone was offline; the queue reaches the server two hours after the start.
    ctx.clock.advance(120 * MINUTE);
    const id = newId(tapStart);
    const start = await ctx.request<{ started: Row }>("POST", "/timer/start", {
      id,
      source: "timer",
      billable: false,
      startedAt: tapStart,
    });
    expect(start.status).toBe(201);
    expect(start.body.started.startedAt).toBe(tapStart);

    const stop = await ctx.request<Row>("POST", "/timer/stop", { endedAt: tapStop });
    expect(stop.status).toBe(200);
    expect(stop.body.endedAt).toBe(tapStop);
    expect((await ctx.request<{ running: Row | null }>("GET", "/timer")).body.running).toBeNull();
  });
});
