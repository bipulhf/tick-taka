import { describe, expect, test } from "bun:test";
import {
  snackAnnouncement,
  snackDuration,
  VISIBLE_MS,
  WITH_ACTION_MS,
} from "../src/lib/snack-timing";

describe("snackbar timing", () => {
  test("defaults: 5 s for a message, 8 s with an Undo", () => {
    expect(snackDuration({ hasAction: false, screenReaderOn: false, recommendedMs: 0 })).toBe(
      VISIBLE_MS,
    );
    expect(snackDuration({ hasAction: true, screenReaderOn: false, recommendedMs: 0 })).toBe(
      WITH_ACTION_MS,
    );
  });

  test("Android's 'Time to take action' setting makes it longer, never shorter", () => {
    expect(snackDuration({ hasAction: true, screenReaderOn: false, recommendedMs: 60_000 })).toBe(
      60_000,
    );
    expect(snackDuration({ hasAction: false, screenReaderOn: false, recommendedMs: 1_000 })).toBe(
      VISIBLE_MS,
    );
  });

  test("with a screen reader on, an Undo stays until used or replaced", () => {
    expect(
      snackDuration({ hasAction: true, screenReaderOn: true, recommendedMs: 8_000 }),
    ).toBeNull();
    expect(snackDuration({ hasAction: false, screenReaderOn: true, recommendedMs: 10_000 })).toBe(
      10_000,
    );
  });

  test("the announcement says an action is there", () => {
    expect(snackAnnouncement("Deleted “Rent”", "Undo")).toBe("Deleted “Rent”. Undo available.");
    expect(snackAnnouncement("Saved.", "Undo")).toBe("Saved. Undo available.");
    expect(snackAnnouncement("Synced")).toBe("Synced");
  });
});
