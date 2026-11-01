import "@/lib/polyfills";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { restoreServerClock } from "@/lib/server-clock";
import { focusStop, runAction } from "./widget-actions";
import { readWidgetCache, type WidgetCache, writeWidgetCache } from "./widget-cache";
import { forgetLook, lookOf, readLooks } from "./widget-looks";
import { UNDO_WINDOW_MS } from "./widget-optimistic";
import { drawWidget, refreshWidgets, WIDGETS } from "./widget-registry";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * After a tap, the Undo strip (or a note like "Too late to undo") goes after a few
 * seconds. Android gives this task 30 s, so it waits here and redraws, unless another
 * tap has replaced it meanwhile. If Android stops the task first, the next redraw
 * leaves the strip out anyway, and a late Undo says so.
 */
async function clearAfterAWhile(shown: WidgetCache): Promise<void> {
  if (!shown.undo && !shown.status) return;
  await wait(UNDO_WINDOW_MS);
  const now = await readWidgetCache();
  const sameUndo = shown.undo !== null && now.undo?.id === shown.undo.id;
  const sameStatus = shown.status !== null && now.status === shown.status;
  if (!sameUndo && !sameStatus) return;
  const cleared: WidgetCache = {
    ...now,
    undo: sameUndo ? null : now.undo,
    status: sameStatus ? null : now.status,
  };
  await writeWidgetCache(cleared);
  await refreshWidgets(cleared);
}

/** Draws the widgets from the cache and runs what a tap on one asks for. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetName, widgetId } = props.widgetInfo;
  if (!(widgetName in WIDGETS)) return;
  if (props.widgetAction === "WIDGET_DELETED") {
    await forgetLook(widgetId);
    return;
  }
  // Edits are stamped in server time; this headless task may run without the app.
  await restoreServerClock(AsyncStorage);
  const now = Date.now();
  let cache = await readWidgetCache();
  // A focus period that ran out while no one looked stops at its end, as in the app.
  if (cache.signedIn && cache.focus && now >= cache.focus.endsAt)
    cache = await focusStop(cache, cache.focus.endsAt);
  const tapped = props.widgetAction === "WIDGET_CLICK" && props.clickAction;
  if (tapped) cache = await runAction(widgetName, tapped, props.clickActionData, now);
  const looks = await readLooks();
  props.renderWidget(drawWidget(widgetName, cache, lookOf(looks, widgetId), props.widgetInfo, now));
  if (!tapped) return;
  // A tick on Today also ticks it on the Tasks list, and so on.
  await refreshWidgets(cache, now);
  await clearAfterAWhile(cache);
}
