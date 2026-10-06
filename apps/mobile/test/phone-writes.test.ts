import { describe, expect, test } from "bun:test";
import { createPhoneWrites, idsOfWrite } from "../src/lib/phone-writes";

describe("ids the phone wrote", () => {
  test("come from the path, the body and the reply", () => {
    expect(idsOfWrite("/transactions", { id: "t1" }, { id: "t1" })).toEqual(["t1", "t1"]);
    const task = "01K0000000000000000000000A";
    expect(idsOfWrite(`/tasks/${task}?x=1`, { title: "x" }, null)).toEqual([task]);
    expect(idsOfWrite("/shopping/checkout", { transactionId: "t9" }, {})).toEqual(["t9"]);
  });

  test("are remembered for an hour, then forgotten", () => {
    let now = 0;
    const writes = createPhoneWrites(() => now);
    writes.record("/transactions", { id: "mine" }, null);
    expect(writes.ids().has("mine")).toBe(true);
    now = 61 * 60_000;
    expect(writes.ids().has("mine")).toBe(false);
  });
});
