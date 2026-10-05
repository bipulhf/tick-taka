import { describe, expect, test } from "bun:test";
import { editTime, noteServerTime } from "../src/lib/server-clock";

describe("server clock", () => {
  test("edit times follow the server even when the phone runs slow", () => {
    const phone = Date.now();
    // Server is 145 s ahead; the request took 200 ms there and back.
    noteServerTime(phone + 145_000 + 100, phone, phone + 200);
    expect(Math.abs(editTime() - (Date.now() + 145_000))).toBeLessThan(50);
  });

  test("a missing header leaves the last offset alone", () => {
    const before = editTime() - Date.now();
    noteServerTime(Number.NaN, 0, 0);
    expect(Math.abs(editTime() - Date.now() - before)).toBeLessThan(50);
  });
});
