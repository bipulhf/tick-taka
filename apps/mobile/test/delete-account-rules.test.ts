import { expect, test } from "bun:test";
import {
  deleteAccountSummary,
  isDeleteConfirmed,
} from "../src/features/settings/delete-account-rules";

test("deleting needs the word typed, not a tap", () => {
  expect(isDeleteConfirmed("")).toBe(false);
  expect(isDeleteConfirmed("DEL")).toBe(false);
  expect(isDeleteConfirmed("delete ")).toBe(true);
  expect(isDeleteConfirmed("DELETE")).toBe(true);
});

test("the summary counts unsynced changes with the right plural", () => {
  expect(deleteAccountSummary(0)).not.toContain("not yet synced");
  expect(deleteAccountSummary(1)).toContain("plus 1 change not yet synced");
  expect(deleteAccountSummary(3)).toContain("plus 3 changes not yet synced");
});
