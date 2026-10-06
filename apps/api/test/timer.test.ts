import { describe, expect, test } from "bun:test";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext, DEFAULT_NOW } from "./helpers";

type Row = Record<string, unknown> & { id: string };
const iso = (ms: number) => new Date(ms).toISOString();

describe("timer honours the phone's tap time", () => {
  test("an offline start and stop replayed later record the real times", async () => {
    const ctx = await createTestContext();
    const tapStart = DEFAULT_NOW;
    const tapStop = tapStart + 45 * MINUTE_MS;
    // Both requests sat in the outbox and reach the server two hours later.
    ctx.clock.set(tapStart + 2 * HOUR_MS);
    const id = newId();
    const start = await ctx.request<{ started: Row }>("POST", "/timer/start", {
      id,
      at: iso(tapStart),
    });
    expect(start.status).toBe(201);
    expect(start.body.started.startedAt).toBe(tapStart);
    const stop = await ctx.request<Row>("POST", "/timer/stop", { at: iso(tapStop) });
    expect(stop.status).toBe(200);
    expect(stop.body).toMatchObject({ id, startedAt: tapStart, endedAt: tapStop });
    expect((await ctx.request<{ running: Row | null }>("GET", "/timer")).body.running).toBeNull();
  });

  test("starting while another runs ends the first at the new tap time", async () => {
    const ctx = await createTestContext();
    await ctx.request("POST", "/timer/start", { at: iso(DEFAULT_NOW) });
    ctx.clock.advance(HOUR_MS);
    const second = await ctx.request<{ stopped: Row }>("POST", "/timer/start", {
      at: iso(DEFAULT_NOW + 20 * MINUTE_MS),
    });
    expect(second.body.stopped.endedAt).toBe(DEFAULT_NOW + 20 * MINUTE_MS);
  });

  test("times far in the future or absurdly old are rejected", async () => {
    const ctx = await createTestContext();
    const future = await ctx.request("POST", "/timer/start", { at: iso(DEFAULT_NOW + HOUR_MS) });
    expect(future.status).toBe(400);
    const ancient = await ctx.request("POST", "/timer/start", {
      at: iso(DEFAULT_NOW - 400 * DAY_MS),
    });
    expect(ancient.status).toBe(400);
    expect((await ctx.request("POST", "/timer/start", { at: "yesterday" })).status).toBe(400);
    // A phone clock a little ahead of the server is fine.
    const skewed = await ctx.request<{ started: Row }>("POST", "/timer/start", {
      at: iso(DEFAULT_NOW + 30_000),
    });
    expect(skewed.status).toBe(201);
  });

  test("a replayed stop returns the stopped entry instead of an error", async () => {
    const ctx = await createTestContext();
    const id = newId();
    await ctx.request("POST", "/timer/start", { id, at: iso(DEFAULT_NOW) });
    ctx.clock.advance(30 * MINUTE_MS);
    const body = { at: iso(DEFAULT_NOW + 25 * MINUTE_MS) };
    const first = await ctx.request<Row>("POST", "/timer/stop", body);
    ctx.clock.advance(3 * HOUR_MS);
    const replay = await ctx.request<Row>("POST", "/timer/stop", body);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const byId = await ctx.request<Row>("POST", "/timer/stop", { id });
    expect(byId.status).toBe(200);
    expect(byId.body.endedAt).toBe(DEFAULT_NOW + 25 * MINUTE_MS);
    // A stop that matches nothing still says so.
    const stray = await ctx.request("POST", "/timer/stop", { at: iso(ctx.clock.now) });
    expect(stray.status).toBe(409);
  });
});
