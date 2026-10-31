import { describe, expect, test } from "bun:test";
import { daysOffFrom } from "../src/recurrence";
import {
  DEFAULT_SETTINGS,
  settingsPatchSchema,
  settingsSchema,
  upgradeStoredSettings,
} from "../src/schemas/settings";

/** What a read ends with: stored rows upgraded, then merged over the defaults. */
const read = (stored: Record<string, unknown>) =>
  settingsSchema.parse({ ...DEFAULT_SETTINGS, ...upgradeStoredSettings(stored) });

describe("one Workdays setting", () => {
  test("by default Saturday to Thursday are workdays and Friday is the one day off", () => {
    expect(DEFAULT_SETTINGS.workdays).toEqual([6, 0, 1, 2, 3, 4]);
    expect(daysOffFrom(DEFAULT_SETTINGS.workdays)).toEqual([5]);
    expect(DEFAULT_SETTINGS).not.toHaveProperty("daysOff");
  });

  test("days off is no longer a setting of its own", () => {
    expect(settingsPatchSchema.parse({ daysOff: [5, 6] })).toEqual({});
  });

  describe("settings stored before the merge", () => {
    test("neither changed: the new default, Friday off", () => {
      expect(read({}).workdays).toEqual([6, 0, 1, 2, 3, 4]);
      // Old defaults stored as values count as unchanged.
      expect(read({ daysOff: [5] }).workdays).toEqual([6, 0, 1, 2, 3, 4]);
    });

    test("only days off changed: workdays become the other days", () => {
      const upgraded = read({ daysOff: [5, 6] });
      expect(upgraded.workdays).toEqual([0, 1, 2, 3, 4]);
      expect(daysOffFrom(upgraded.workdays)).toEqual([5, 6]);
      // The old default workdays stored as a value is still "never changed".
      expect(read({ daysOff: [4, 5], workdays: [0, 1, 2, 3, 4] }).workdays).toEqual([
        0, 1, 2, 3, 6,
      ]);
      expect(read({ daysOff: [] }).workdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test("only workdays changed: kept as they are", () => {
      expect(read({ workdays: [1, 2, 3, 4, 5] }).workdays).toEqual([1, 2, 3, 4, 5]);
      expect(read({ workdays: [1, 2, 3, 4, 5], daysOff: [5] }).workdays).toEqual([1, 2, 3, 4, 5]);
      // Sunday to Thursday picked on purpose stays (Friday and Saturday off).
      expect(read({ workdays: [0, 1, 2, 3, 4] }).workdays).toEqual([0, 1, 2, 3, 4]);
    });

    test("both changed: workdays win", () => {
      expect(read({ workdays: [1, 2, 3, 4, 5], daysOff: [0] }).workdays).toEqual([1, 2, 3, 4, 5]);
    });

    test("a days-off value that can't be read is ignored", () => {
      expect(read({ daysOff: "friday" }).workdays).toEqual([6, 0, 1, 2, 3, 4]);
      expect(read({ daysOff: [9] }).workdays).toEqual([6, 0, 1, 2, 3, 4]);
    });

    test("daysOff is dropped and other settings pass through", () => {
      const upgraded = upgradeStoredSettings({ daysOff: [5, 6], dailyTaskGoal: 3 });
      expect(upgraded).toEqual({ dailyTaskGoal: 3, workdays: [0, 1, 2, 3, 4] });
      expect(upgradeStoredSettings({ dailyTaskGoal: 3 })).toEqual({ dailyTaskGoal: 3 });
    });
  });
});
