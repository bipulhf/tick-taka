import { expect, test } from "bun:test";
import { billStatusText } from "../src/features/money/bill-status";

test("a late bill says when it was due, never 'Overdue'", () => {
  expect(billStatusText("overdue", "2026-10-05")).toBe("Was due Mon 5 Oct");
  expect(billStatusText("overdue")).toBe("From earlier");
  expect(billStatusText("due_today")).toBe("Due today");
  expect(billStatusText("due_soon")).toBe("Due soon");
  expect(billStatusText("upcoming")).toBe("");
});
