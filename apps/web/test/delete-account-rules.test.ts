import { expect, test } from "bun:test";
import {
  canDeleteAccount,
  DELETE_ACCOUNT_SUMMARY,
  exportFileName,
  exportStepNote,
  isDeleteConfirmed,
} from "../src/features/settings/delete-account-rules";

test("only the typed word confirms, in any case, around spaces", () => {
  expect(isDeleteConfirmed(" delete ")).toBe(true);
  expect(isDeleteConfirmed("DELET")).toBe(false);
});

test("deleting needs the word and the user's own word that the copy is saved", () => {
  expect(canDeleteAccount("DELETE", false)).toBe(false);
  expect(canDeleteAccount("nope", true)).toBe(false);
  expect(canDeleteAccount("DELETE", true)).toBe(true);
});

test("the export step asks to check the file, before and after the download", () => {
  expect(exportStepNote(false)).toContain("check it arrived");
  expect(exportStepNote(true)).toContain("downloaded");
  expect(exportStepNote(true)).toContain("check");
});

test("the summary says what goes and that it can't be undone, with no unsynced changes", () => {
  expect(DELETE_ACCOUNT_SUMMARY).toContain("can't be undone");
  expect(DELETE_ACCOUNT_SUMMARY).not.toContain("synced");
});

test("the export file is named like the phone's", () => {
  expect(exportFileName(new Date(Date.UTC(2026, 9, 7, 12)))).toBe(
    "tick-taka-export-2026-10-07.json",
  );
});
