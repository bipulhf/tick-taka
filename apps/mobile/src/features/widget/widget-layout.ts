/**
 * Which pills the home-screen widget shows, and how wide, for its size on the
 * launcher. Pure, so the trade-offs are tested rather than guessed:
 *
 * - The one-tap quick-logs are the widget's fastest path, so at the default 4×2
 *   size they replace Focus and Tiki in the single row of pills (beside Task and
 *   Expense) instead of waiting for a tall widget.
 * - Every pill is at least 48 dp, and a label is only shown when it fits. Names
 *   come first: a second quick-log gives way before Task and Expense lose theirs.
 *   Only then does an action fall back to its glyph ("－"), keeping its full name
 *   for screen readers, and a quick-log that doesn't fit is left out.
 * - The row shares out its width in proportion to the widths worked out here, so
 *   each pill gets at least the width its label needs. A wider widget never shows
 *   fewer names.
 */

/** Every tappable part of the widget is at least this wide and tall (dp). */
export const TARGET = 48;
/** Below this height (dp) only the numbers and one row of pills fit. */
export const COMPACT = 160;
/** At or above this height (dp) the quick-logs get a row of their own. */
export const TALL = 240;
/** The widget's padding on each side, and the gap between pills (dp). */
export const PADDING = 12;
export const GAP = 6;
/** The launcher's minimum width (app.json minWidth), assumed when it isn't known. */
export const MIN_WIDTH = 250;
/** Space a row pill keeps on each side of its label (dp), applied as its padding. */
export const PILL_PADDING = 8;
/** At most this many quick-logs share the row with Task and Expense. */
const INLINE_QUICK = 2;

export type WidgetAction = "task" | "expense" | "focus" | "tiki";

export const ACTIONS: Record<WidgetAction, { label: string; glyph: string; name: string }> = {
  task: { label: "✓ Task", glyph: "✓", name: "Add a task" },
  expense: { label: "－ Expense", glyph: "－", name: "Log an expense" },
  focus: { label: "▶ Focus", glyph: "▶", name: "Start focus" },
  tiki: { label: "🎙 Tiki", glyph: "🎙", name: "Talk to Tiki" },
};

export type WidgetSlot =
  | { kind: "action"; action: WidgetAction; glyph: boolean; width: number }
  | { kind: "quick"; index: number; width: number }
  | { kind: "undo" | "keep"; width: number };

export interface WidgetLayout {
  size: "compact" | "normal" | "tall";
  /** The row of pills along the bottom, left to right. */
  row: WidgetSlot[];
  /** Tall only: quick-logs (indexes into the cache's list) in a row of their own. */
  quickRow: number[];
  /** Tall only: the last log with Undo and Keep, in a row of their own. */
  undoRow: boolean;
}

/** Rough width (dp) of a 13 dp bold label: wide glyphs and emoji take about twice a letter. */
export function labelWidth(label: string): number {
  let width = 0;
  for (const char of label) {
    const code = char.codePointAt(0) ?? 0;
    const wide = code >= 0x2190 && !(code >= 0x0980 && code <= 0x09ff);
    width += wide ? 14 : char === " " ? 4 : 7.5;
  }
  return Math.ceil(width);
}

/** A pill's width for a label: the label plus its padding, never under 48 dp. */
export function pillWidth(label: string): number {
  return Math.max(TARGET, labelWidth(label) + 2 * PILL_PADDING);
}

function total(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1);
}

function actionSlots(actions: WidgetAction[], glyph: boolean): WidgetSlot[] {
  return actions.map((action) => ({
    kind: "action",
    action,
    glyph,
    width: pillWidth(glyph ? ACTIONS[action].glyph : ACTIONS[action].label),
  }));
}

/** Actions with full labels if they fit, else glyphs; trailing ones go if even glyphs don't. */
function fitActions(actions: WidgetAction[], room: number, fixed: number[] = []): WidgetSlot[] {
  for (const glyph of [false, true]) {
    const slots = actionSlots(actions, glyph);
    if (total([...fixed, ...slots.map((s) => s.width)]) <= room) return slots;
  }
  const slots = actionSlots(actions, true);
  while (slots.length && total([...fixed, ...slots.map((s) => s.width)]) > room) slots.pop();
  return slots;
}

/** Quick-logs, in order, that fit beside `taken`, up to `limit`. */
type QuickSlot = Extract<WidgetSlot, { kind: "quick" }>;

function fitQuick(quick: string[], room: number, taken: number[], limit: number): QuickSlot[] {
  const slots: QuickSlot[] = [];
  for (const [index, label] of quick.entries()) {
    if (slots.length === limit) break;
    const width = pillWidth(label);
    if (total([...taken, ...slots.map((s) => s.width), width]) > room) break;
    slots.push({ kind: "quick", index, width });
  }
  return slots;
}

export function widgetLayout({
  width,
  height,
  quick,
  undo,
}: {
  /** The widget's size on the launcher (dp); 0 when the launcher hasn't said. */
  width: number;
  height: number;
  /** The quick-log labels as shown ("Cha ৳20"). */
  quick: string[];
  /** A quick-log can still be undone. */
  undo: boolean;
}): WidgetLayout {
  const room = (width > 0 ? width : MIN_WIDTH) - 2 * PADDING;
  const size = height >= TALL ? "tall" : height > 0 && height < COMPACT ? "compact" : "normal";
  const all: WidgetAction[] = ["task", "expense", "focus", "tiki"];

  if (size === "tall") {
    return {
      size,
      row: fitActions(all, room),
      quickRow: undo ? [] : fitQuick(quick, room, [], quick.length).map((s) => s.index),
      undoRow: undo,
    };
  }

  const base: WidgetAction[] = ["task", "expense"];
  if (undo) {
    const undoWidth = pillWidth("Undo");
    const keepWidth = pillWidth("Keep");
    const row: WidgetSlot[] = [
      { kind: "undo", width: undoWidth },
      { kind: "keep", width: keepWidth },
      ...fitActions(base, room, [undoWidth, keepWidth]),
    ];
    return { size, row, quickRow: [], undoRow: false };
  }

  if (quick.length > 0) {
    // Full labels with as many quick-logs as fit beside them; glyphs only when not even one does.
    for (const glyph of [false, true]) {
      const actions = actionSlots(base, glyph);
      const logs = fitQuick(
        quick,
        room,
        actions.map((s) => s.width),
        INLINE_QUICK,
      );
      if (logs.length > 0)
        return { size, row: [...actions, ...logs], quickRow: [], undoRow: false };
    }
  }

  return { size, row: fitActions(all, room), quickRow: [], undoRow: false };
}
