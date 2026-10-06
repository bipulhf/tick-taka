import { describe, expect, test } from "bun:test";
import {
  editTime,
  noteServerTime,
  restoreServerClock,
  serverTimeOf,
  toServerTime,
} from "../src/lib/server-clock";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: async (key: string) => data[key] ?? null,
    setItem: async (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("server clock", () => {
  test("a saved offset applies after an offline restart, until a reply teaches a new one", async () => {
    // QA-212: the phone runs 6 minutes fast; the offset learned last run was saved.
    await restoreServerClock(memoryStorage({ "tt.server-clock": String(-360_000) }));
    expect(Math.abs(editTime() - (Date.now() - 360_000))).toBeLessThan(50);
    expect(Math.abs(toServerTime(1_000_000) - (1_000_000 - 360_000))).toBeLessThan(1);
  });

  test("edit times follow the server even when the phone runs slow, and the offset is saved", async () => {
    const storage = memoryStorage();
    await restoreServerClock(storage);
    const phone = Date.now();
    // Server is 145 s ahead; the request took 200 ms there and back.
    noteServerTime(phone + 145_000 + 100, phone, phone + 200);
    expect(Math.abs(editTime() - (Date.now() + 145_000))).toBeLessThan(50);
    await Promise.resolve();
    expect(Number(storage.data["tt.server-clock"])).toBe(145_000);
  });

  test("a reply with no x-server-time leaves the last offset alone", async () => {
    // CQ-036: a proxy's own 502 has no header. The old code read it as Number(null) = 0.
    const storage = memoryStorage();
    await restoreServerClock(storage);
    const phone = Date.now();
    noteServerTime(phone + 5_000, phone, phone);
    const before = editTime() - Date.now();
    const missing = serverTimeOf(new Headers());
    expect(missing).toBeNaN();
    noteServerTime(missing, phone, phone + 100);
    noteServerTime(Number(new Headers().get("x-server-time")), phone, phone + 100);
    noteServerTime(serverTimeOf(new Headers({ "x-server-time": "" })), phone, phone + 100);
    expect(Math.abs(editTime() - Date.now() - before)).toBeLessThan(50);
    expect(editTime()).toBeGreaterThan(Date.UTC(2026, 0, 1));
    await Promise.resolve();
    expect(Number(storage.data["tt.server-clock"])).toBe(5_000);
  });

  test("an impossible server time (zero, negative, before the app existed) is ignored", () => {
    const before = editTime() - Date.now();
    for (const bad of [0, -50, 60_000, Date.UTC(2023, 11, 31), Number.POSITIVE_INFINITY])
      noteServerTime(bad, Date.now(), Date.now());
    expect(Math.abs(editTime() - Date.now() - before)).toBeLessThan(50);
  });

  test("a header with a real time is read as that time", () => {
    expect(serverTimeOf(new Headers({ "x-server-time": "1791319466210" }))).toBe(1791319466210);
  });

  test("a saved offset that puts now before 2024 is not restored", async () => {
    // A fresh copy of the module: nothing learned in this run yet, as at a cold start.
    const coldStart = "../src/lib/server-clock.ts?cold-start";
    const fresh = (await import(coldStart)) as typeof import("../src/lib/server-clock");
    // What a header-less reply saved under the old code: "now" was 1970.
    await fresh.restoreServerClock(memoryStorage({ "tt.server-clock": String(-Date.now()) }));
    expect(Math.abs(fresh.editTime() - Date.now())).toBeLessThan(50);
  });

  test("request() through ky ignores a reply that has no x-server-time", async () => {
    const http = await import("../src/lib/http");
    const realFetch = globalThis.fetch;
    const phone = Date.now();
    noteServerTime(phone + 3_000, phone, phone);
    const before = editTime();
    try {
      // Nginx's own 502 while the API restarts: no x-server-time header.
      globalThis.fetch = (async () =>
        new Response("<html>502 Bad Gateway</html>", { status: 502 })) as unknown as typeof fetch;
      const response = await http.request(http.apiUrl("/tasks"));
      expect(response.status).toBe(502);
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(Math.abs(editTime() - before)).toBeLessThan(1_000);
  });

  test("an offset already learned this run is not replaced by an older saved one", async () => {
    const phone = Date.now();
    noteServerTime(phone + 10_000, phone, phone);
    await restoreServerClock(memoryStorage({ "tt.server-clock": "999999" }));
    expect(Math.abs(editTime() - (Date.now() + 10_000))).toBeLessThan(50);
  });
});
