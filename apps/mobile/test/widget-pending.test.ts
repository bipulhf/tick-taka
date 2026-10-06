import { describe, expect, test } from "bun:test";
import { afterHandOver } from "../src/features/widget/widget-pending";

const byId = (log: { id: string }) => log.id;

describe("handing widget logs to the outbox", () => {
  test("only the logs that were sent leave the list", () => {
    const stored = [{ id: "a" }, { id: "b" }];
    expect(afterHandOver(stored, [{ id: "a" }, { id: "b" }], byId)).toEqual([]);
  });

  test("a tap that landed during the hand-over stays for the next one", () => {
    const sent = [{ id: "a" }];
    const storedNow = [{ id: "a" }, { id: "late" }];
    expect(afterHandOver(storedNow, sent, byId)).toEqual([{ id: "late" }]);
  });

  test("works for plain ids too", () => {
    expect(afterHandOver(["x", "y"], ["x"], (id) => id)).toEqual(["y"]);
  });
});
