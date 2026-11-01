// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import type { JSX } from "react";
import { requestWidgetUpdate, type WidgetRepresentation } from "react-native-android-widget";
import type { WidgetCache } from "./widget-cache";
import { type Face, type Look, lookColors } from "./widget-colors";
import { lookOf, readLooks } from "./widget-looks";
import { WIDGET_NAMES } from "./widget-names";
import { BillsWidget } from "./widgets/bills";
import { FocusWidget } from "./widgets/focus";
import { HabitsWidget } from "./widgets/habits";
import { SignedOut } from "./widgets/parts";
import { QuickLogWidget } from "./widgets/quick-log";
import { SafeSpendWidget } from "./widgets/safe-spend";
import { TasksListWidget } from "./widgets/tasks-list";
import { ThisMonthWidget } from "./widgets/this-month";
import { TodayWidget } from "./widgets/today";
import type { WidgetProps } from "./widgets/types";

interface Entry {
  draw: (props: WidgetProps) => JSX.Element;
  /** A 2×2 (or smaller) widget: the signed-out state stacks. */
  small: boolean;
}

const WIDE = { width: 340, height: 200 };
const SQUARE = { width: 170, height: 170 };

/** A widget's usual size on the launcher (dp), for previews before it has one. */
export const PREVIEW_SIZES: Record<string, { width: number; height: number }> = {
  [WIDGET_NAMES.today]: WIDE,
  [WIDGET_NAMES.quickLog]: { width: 340, height: 80 },
  [WIDGET_NAMES.spend]: SQUARE,
  [WIDGET_NAMES.habits]: SQUARE,
  [WIDGET_NAMES.bills]: WIDE,
  [WIDGET_NAMES.focus]: SQUARE,
  [WIDGET_NAMES.month]: SQUARE,
  [WIDGET_NAMES.tasks]: { width: 340, height: 300 },
};

/** Every widget the app draws, by its registered name. */
export const WIDGETS: Record<string, Entry> = {
  [WIDGET_NAMES.today]: { draw: TodayWidget, small: false },
  [WIDGET_NAMES.quickLog]: { draw: QuickLogWidget, small: false },
  [WIDGET_NAMES.spend]: { draw: SafeSpendWidget, small: true },
  [WIDGET_NAMES.habits]: { draw: HabitsWidget, small: true },
  [WIDGET_NAMES.focus]: { draw: FocusWidget, small: true },
  [WIDGET_NAMES.bills]: { draw: BillsWidget, small: false },
  [WIDGET_NAMES.month]: { draw: ThisMonthWidget, small: true },
  [WIDGET_NAMES.tasks]: { draw: TasksListWidget, small: false },
};

/** One widget in one look: its own drawing, or the signed-out state. */
export function drawFace(
  name: string,
  cache: WidgetCache,
  face: Face,
  size: { width: number; height: number },
  now: number,
): JSX.Element {
  const entry = WIDGETS[name] ?? WIDGETS[WIDGET_NAMES.today];
  const c = lookColors(face);
  if (!entry || !cache.signedIn) return <SignedOut c={c} small={entry?.small ?? false} />;
  const Draw = entry.draw;
  return <Draw name={name} cache={cache} c={c} width={size.width} height={size.height} now={now} />;
}

/** A widget in its look: Auto gives the launcher a light and a dark drawing to pick from. */
export function drawWidget(
  name: string,
  cache: WidgetCache,
  look: Look,
  size: { width: number; height: number },
  now = Date.now(),
): WidgetRepresentation {
  if (look === "auto")
    return {
      light: drawFace(name, cache, "paper", size, now),
      dark: drawFace(name, cache, "night", size, now),
    };
  const drawn = drawFace(name, cache, look, size, now);
  return { light: drawn, dark: drawn };
}

/** Redraws every widget on the home screen, each in its own look. */
export async function refreshWidgets(cache: WidgetCache, now = Date.now()): Promise<void> {
  const looks = await readLooks();
  await Promise.all(
    Object.keys(WIDGETS).map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info) =>
          drawWidget(widgetName, cache, lookOf(looks, info.widgetId), info, now),
      }).catch(() => {}),
    ),
  );
}
