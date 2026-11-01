/**
 * How much fits on a widget at its size on the launcher. Pure, so the trade-offs are
 * tested rather than guessed:
 *
 * - Every button is at least 48 dp tall, and a label is only shown when it fits.
 * - The Today widget's row of actions (Task, Expense, Focus, Tiki) shows names
 *   first; only when they don't fit do the actions become glyphs (✓ －, never ＋
 *   beside －, which would read as income and expense), keeping their full names for
 *   screen readers. Trailing actions go before a glyph would be cut off.
 * - A row shares out its width in proportion to the widths worked out here, so each
 *   pill gets at least the width its label needs. A wider widget never shows fewer names.
 * - Lists (tasks, bills, habit rings, quick-log chips) show as many whole items as
 *   fit, never one cut in half.
 */

/** Every button is at least this tall (dp). */
export const TARGET = 48;
/** The widget's padding on each side, and the gap between pills (dp). */
export const PADDING = 12;
export const GAP = 6;
/** The launcher's minimum width for a 4-wide widget, assumed when it isn't known. */
export const MIN_WIDTH = 250;
/** Space a row pill keeps on each side of its label (dp), applied as its padding. */
export const PILL_PADDING = 8;

export type WidgetAction = "task" | "expense" | "focus" | "tiki";

export const ACTIONS: Record<WidgetAction, { label: string; glyph: string; name: string }> = {
  task: { label: "＋ Task", glyph: "✓", name: "Add a task" },
  expense: { label: "－ Expense", glyph: "－", name: "Log an expense" },
  focus: { label: "▶ Focus", glyph: "▶", name: "Start focus" },
  tiki: { label: "🎙 Tiki", glyph: "🎙", name: "Talk to Tiki" },
};

export interface ActionSlot {
  action: WidgetAction;
  glyph: boolean;
  width: number;
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

/** The width a row of items takes, with the gaps between them. */
export function rowWidth(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1);
}

/** The room inside a widget of this width (dp), assuming the minimum when unknown. */
export function innerWidth(width: number, fallback = MIN_WIDTH): number {
  return (width > 0 ? width : fallback) - 2 * PADDING;
}

function slots(actions: WidgetAction[], glyph: boolean): ActionSlot[] {
  return actions.map((action) => ({
    action,
    glyph,
    width: pillWidth(glyph ? ACTIONS[action].glyph : ACTIONS[action].label),
  }));
}

/** The Today widget's actions: names if they fit, else glyphs; trailing ones go if even glyphs don't. */
export function actionRow({
  width,
  assistant = true,
}: {
  /** The widget's width on the launcher (dp); 0 when the launcher hasn't said. */
  width: number;
  /** Tiki can answer (the server's AI is set up and the chat is on); else its pill is left out. */
  assistant?: boolean;
}): ActionSlot[] {
  const room = innerWidth(width);
  const all: WidgetAction[] = assistant
    ? ["task", "expense", "focus", "tiki"]
    : ["task", "expense", "focus"];
  for (const glyph of [false, true]) {
    const row = slots(all, glyph);
    if (rowWidth(row.map((s) => s.width)) <= room) return row;
  }
  const row = slots(all, true);
  while (row.length && rowWidth(row.map((s) => s.width)) > room) row.pop();
  return row;
}

/** How many of `labels`, in order, fit as chips in `room` beside `reserved` widths. */
export function chipsThatFit(labels: string[], room: number, reserved: number[] = []): number {
  let count = 0;
  const taken = [...reserved];
  for (const label of labels) {
    taken.push(pillWidth(label));
    if (rowWidth(taken) > room) break;
    count++;
  }
  return count;
}

/** How many rows of `rowHeight` fit in `room` (dp), with `gap` between them, up to `max`. */
export function rowsThatFit(room: number, rowHeight: number, gap: number, max: number): number {
  if (room < rowHeight) return 0;
  return Math.min(max, Math.floor((room + gap) / (rowHeight + gap)));
}
