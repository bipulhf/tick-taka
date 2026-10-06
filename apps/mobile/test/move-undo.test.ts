import { expect, test } from "bun:test";
import { previousFields } from "../src/features/plan/move-undo";

test("moving a task remembers exactly the fields it changes", () => {
  const task = { id: "a", doAt: 5, hasTime: false, reminderAt: null, status: "inbox", title: "x" };
  expect(previousFields(task, { doAt: 9, status: "open", reminderAt: 9 })).toEqual({
    doAt: 5,
    status: "inbox",
    reminderAt: null,
  });
});
