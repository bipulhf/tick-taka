import { expect, test } from "bun:test";
import {
  canDeleteAccount,
  deleteAccountSummary,
  exportStepNote,
  isDeleteConfirmed,
} from "../src/features/settings/delete-account-rules";

// QA-402 / UX-052: a share sheet returning isn't proof the copy was saved.
test("deleting also needs the user to say their copy is saved (or not wanted)", () => {
  expect(canDeleteAccount("DELETE", false)).toBe(false);
  expect(canDeleteAccount("DEL", true)).toBe(false);
  expect(canDeleteAccount("delete", true)).toBe(true);
});

test("the export step asks to check the copy arrived, never says it was saved", () => {
  expect(exportStepNote(false)).toContain("check it arrived");
  expect(exportStepNote(true)).toContain("check");
  expect(exportStepNote(true)).not.toMatch(/\bsaved\b/i);
});

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
