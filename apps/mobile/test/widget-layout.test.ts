import { describe, expect, test } from "bun:test";
import {
  ACTIONS,
  GAP,
  labelWidth,
  PADDING,
  pillWidth,
  TARGET,
  type WidgetLayout,
  widgetLayout,
} from "../src/features/widget/widget-layout";

const QUICK = ["Cha ৳20", "Rickshaw ৳60", "Lunch ৳150"];
/** A 4×2 widget on common launchers: about 320-360 dp wide and 180-220 dp tall. */
const DEFAULT = { width: 340, height: 200 };

const kinds = (layout: WidgetLayout) =>
  layout.row.map((slot) =>
    slot.kind === "action"
      ? `${slot.action}${slot.glyph ? ":glyph" : ""}`
      : slot.kind === "quick"
        ? `quick:${slot.index}`
        : slot.kind,
  );

/** The row's pills, at their widths, fit inside the widget. */
function fits(layout: WidgetLayout, width: number) {
  const widths = layout.row.map((slot) => slot.width);
  const used = widths.reduce((sum, w) => sum + w, 0) + GAP * (widths.length - 1);
  return used <= width - 2 * PADDING;
}

describe("widget layout", () => {
  test("at the default 4×2 size the quick-logs share the row with Task and Expense", () => {
    const layout = widgetLayout({ ...DEFAULT, quick: QUICK, undo: false });
    expect(layout.size).toBe("normal");
    expect(kinds(layout)).toEqual(["task:glyph", "expense:glyph", "quick:0", "quick:1"]);
    expect(fits(layout, DEFAULT.width)).toBe(true);
  });

  test("at the minimum width a quick-log still shows, and nothing is cut off", () => {
    const layout = widgetLayout({ width: 250, height: 180, quick: QUICK, undo: false });
    expect(kinds(layout)).toContain("quick:0");
    expect(fits(layout, 250)).toBe(true);
  });

  test("full labels are kept when glyphs wouldn't make room for more quick-logs", () => {
    const layout = widgetLayout({ width: 320, height: 200, quick: ["Cha ৳20"], undo: false });
    expect(kinds(layout)).toEqual(["task", "expense", "quick:0"]);
  });

  test("with no quick-logs saved, all four actions show, as glyphs when labels won't fit", () => {
    expect(kinds(widgetLayout({ width: 400, height: 200, quick: [], undo: false }))).toEqual([
      "task",
      "expense",
      "focus",
      "tiki",
    ]);
    const narrow = widgetLayout({ width: 250, height: 200, quick: [], undo: false });
    expect(kinds(narrow)).toEqual(["task:glyph", "expense:glyph", "focus:glyph", "tiki:glyph"]);
    expect(fits(narrow, 250)).toBe(true);
  });

  test("an undoable log offers Undo and Keep at the default size, not only on a tall widget", () => {
    const layout = widgetLayout({ ...DEFAULT, quick: QUICK, undo: true });
    expect(kinds(layout).slice(0, 2)).toEqual(["undo", "keep"]);
    expect(kinds(layout)).toContain("expense");
    expect(fits(layout, DEFAULT.width)).toBe(true);
    expect(fits(widgetLayout({ width: 250, height: 180, quick: QUICK, undo: true }), 250)).toBe(
      true,
    );
  });

  test("a tall widget gives the quick-logs and the undo line rows of their own", () => {
    const tall = widgetLayout({ width: 340, height: 260, quick: QUICK, undo: false });
    expect(tall.size).toBe("tall");
    expect(tall.quickRow.length).toBeGreaterThan(0);
    expect(kinds(tall).filter((k) => k.startsWith("quick"))).toEqual([]);
    const undo = widgetLayout({ width: 340, height: 260, quick: QUICK, undo: true });
    expect(undo.undoRow).toBe(true);
    expect(undo.quickRow).toEqual([]);
  });

  test("a short widget is compact but keeps its row of pills", () => {
    const layout = widgetLayout({ width: 340, height: 140, quick: QUICK, undo: false });
    expect(layout.size).toBe("compact");
    expect(kinds(layout)).toContain("quick:0");
  });

  test("an unknown size is laid out for the narrowest widget", () => {
    const layout = widgetLayout({ width: 0, height: 0, quick: QUICK, undo: false });
    expect(fits(layout, 250)).toBe(true);
  });

  test("every pill is a 48 dp target with room for its label", () => {
    for (const { label, glyph } of Object.values(ACTIONS)) {
      expect(pillWidth(glyph)).toBeGreaterThanOrEqual(TARGET);
      expect(pillWidth(label)).toBeGreaterThan(labelWidth(label));
    }
    expect(pillWidth("－ Expense")).toBeGreaterThan(65);
  });
});
