import "@/lib/polyfills";
import { newId } from "@tick-taka/shared/ids";
import * as SecureStore from "expo-secure-store";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { API_URL } from "@/lib/config";
import { SafeToSpendWidget } from "./safe-to-spend-widget";
import {
  readPendingLogs,
  readWidgetCache,
  writePendingLogs,
  writeWidgetCache,
} from "./widget-cache";

export const WIDGET_NAME = "SafeToSpend";

/** Logs "cha 20" without opening the app; offline taps wait for the app to send them. */
async function logQuickEntry(index: number) {
  const cache = await readWidgetCache();
  const entry = cache.quick[index];
  if (!entry || !cache.accountId)
    return { ...cache, status: "Open the app once to set up quick logging" };
  const log = {
    id: newId(),
    note: entry.note,
    amountMinor: entry.amountMinor,
    categoryId: entry.categoryId,
    accountId: cache.accountId,
    occurredAt: Date.now(),
  };
  const token = await SecureStore.getItemAsync("tt.token");
  let status = `Logged ${entry.label} ✓`;
  try {
    const response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ ...log, type: "expense" }),
    });
    if (!response.ok) throw new Error(String(response.status));
  } catch {
    await writePendingLogs([...(await readPendingLogs()), log]);
    status = `Saved ${entry.label}; it syncs when online`;
  }
  const next = {
    ...cache,
    leftTodayMinor: cache.leftTodayMinor === null ? null : cache.leftTodayMinor - entry.amountMinor,
    status,
  };
  await writeWidgetCache(next);
  return next;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== WIDGET_NAME || props.widgetAction === "WIDGET_DELETED")
    return;
  let cache = await readWidgetCache();
  if (props.widgetAction === "WIDGET_CLICK" && props.clickAction === "LOG") {
    cache = await logQuickEntry(Number(props.clickActionData?.index ?? -1));
  }
  props.renderWidget({
    light: <SafeToSpendWidget cache={cache} scheme="light" />,
    dark: <SafeToSpendWidget cache={cache} scheme="dark" />,
  });
}
