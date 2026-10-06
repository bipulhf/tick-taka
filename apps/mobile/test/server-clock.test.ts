import { describe, expect, test } from "bun:test";
import {
  editTime,
  noteServerTime,
  restoreServerClock,
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

  test("a missing header leaves the last offset alone", () => {
    const before = editTime() - Date.now();
    noteServerTime(Number.NaN, 0, 0);
    expect(Math.abs(editTime() - Date.now() - before)).toBeLessThan(50);
  });

  test("an offset already learned this run is not replaced by an older saved one", async () => {
    const phone = Date.now();
    noteServerTime(phone + 10_000, phone, phone);
    await restoreServerClock(memoryStorage({ "tt.server-clock": "999999" }));
    expect(Math.abs(editTime() - (Date.now() + 10_000))).toBeLessThan(50);
  });
});
