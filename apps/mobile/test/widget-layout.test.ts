import { describe, expect, test } from "bun:test";
import {
  ACTIONS,
  type ActionSlot,
  actionRow,
  chipsThatFit,
  innerWidth,
  labelWidth,
  PILL_PADDING,
  pillWidth,
  rowsThatFit,
  rowWidth,
  TARGET,
} from "../src/features/widget/widget-layout";

const kinds = (row: ActionSlot[]) =>
  row.map((slot) => `${slot.action}${slot.glyph ? ":glyph" : ""}`);

/** The row's pills, at their widths, fit inside the widget. */
const fits = (row: ActionSlot[], width: number) =>
  rowWidth(row.map((slot) => slot.width)) <= innerWidth(width);

describe("the Today widget's actions", () => {
  test("at the default 4×2 size every action shows its name", () => {
    const row = actionRow({ width: 340 });
    expect(kinds(row)).toEqual(["task", "expense", "focus", "tiki"]);
    expect(fits(row, 340)).toBe(true);
  });

  test("names never disappear as the widget gets wider, and nothing is cut off", () => {
    let before = 0;
    for (let width = 250; width <= 480; width += 10) {
      const row = actionRow({ width });
      expect(fits(row, width)).toBe(true);
      const named = row.filter((slot) => !slot.glyph).length;
      expect(named).toBeGreaterThanOrEqual(before);
      before = named;
    }
  });

  test("on the narrowest widget the actions become glyphs", () => {
    const row = actionRow({ width: 250 });
    expect(kinds(row)).toEqual(["task:glyph", "expense:glyph", "focus:glyph", "tiki:glyph"]);
    expect(fits(row, 250)).toBe(true);
    // An unknown size is laid out for the narrowest widget.
    expect(fits(actionRow({ width: 0 }), 250)).toBe(true);
  });

  test("Task's glyph doesn't read as the opposite of Expense's", () => {
    expect(ACTIONS.task.glyph).not.toBe("＋");
    expect(ACTIONS.task.glyph).not.toBe("+");
  });

  test("with the AI off, Tiki is left out and its room goes to the other actions", () => {
    expect(kinds(actionRow({ width: 300, assistant: false }))).toEqual([
      "task",
      "expense",
      "focus",
    ]);
    expect(actionRow({ width: 300 }).every((slot) => slot.glyph)).toBe(true);
  });

  test("every pill is a 48 dp target with room for its label", () => {
    for (const { label, glyph } of Object.values(ACTIONS)) {
      expect(pillWidth(glyph)).toBeGreaterThanOrEqual(TARGET);
      expect(pillWidth(label)).toBeGreaterThan(labelWidth(label));
    }
    const label = ACTIONS.expense.label;
    expect(pillWidth(label)).toBe(labelWidth(label) + 2 * PILL_PADDING);
  });
});

describe("lists fit whole items only", () => {
  test("quick-log chips: as many as fit beside the ＋, never one cut off", () => {
    const chips = ["☕ Cha ৳20", "🛺 Rickshaw ৳60", "🍱 Lunch ৳180", "🚌 Bus ৳30"];
    const room = innerWidth(340);
    const shown = chipsThatFit(chips, room, [TARGET]);
    expect(shown).toBeGreaterThanOrEqual(2);
    expect(shown).toBeLessThan(chips.length);
    expect(rowWidth([TARGET, ...chips.slice(0, shown).map(pillWidth)])).toBeLessThanOrEqual(room);
    expect(chipsThatFit(chips, 40)).toBe(0);
  });

  test("rows: as many as the height holds, up to the most wanted", () => {
    expect(rowsThatFit(98, 30, 4, 3)).toBe(3);
    expect(rowsThatFit(70, 30, 4, 3)).toBe(2);
    expect(rowsThatFit(20, 30, 4, 3)).toBe(0);
    expect(rowsThatFit(400, 30, 4, 3)).toBe(3);
  });
});
