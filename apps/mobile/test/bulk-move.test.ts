import { describe, expect, test } from "bun:test";
import { movedBefore, movedMessage, undoMoves } from "../src/features/today/bulk-move";

const task = (id: string, title: string) => ({
  id,
  title,
  status: "open",
  doAt: 1_000,
  hasTime: true,
  reminderAt: 900,
  top3Date: null,
});

describe("bulk moves on Today", () => {
  test("the snackbar names what moved", () => {
    expect(movedMessage([task("a", "Call bank")], "today")).toBe("Moved “Call bank” to today");
    expect(movedMessage([task("a", "A"), task("b", "B")], "tomorrow")).toBe(
      "Moved “A” and “B” to tomorrow",
    );
    expect(
      movedMessage([task("a", "A"), task("b", "B"), task("c", "C"), task("d", "D")], "today"),
    ).toBe("Moved “A”, “B” and 2 more to today");
    expect(movedMessage([], "today")).toBe("Nothing needed moving");
  });

  test("Undo puts each task back exactly as it was", () => {
    const [undo] = undoMoves([{ ...task("a", "A"), status: "inbox", doAt: null }], 5_000);
    expect(undo).toEqual({
      method: "PATCH",
      path: "/tasks/a",
      body: {
        status: "inbox",
        doAt: null,
        hasTime: true,
        reminderAt: 900,
        top3Date: null,
        updatedAt: 5_000,
      },
      label: "Couldn't undo the move",
    });
  });

  test("a reply without the earlier state (older server) gives nothing to undo", () => {
    expect(movedBefore({ moved: 2 })).toEqual([]);
    expect(movedBefore({ moved: 1, before: [task("a", "A")] })).toHaveLength(1);
  });
});
