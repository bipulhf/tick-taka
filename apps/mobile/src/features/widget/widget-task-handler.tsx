import "@/lib/polyfills";
import { newId } from "@tick-taka/shared/ids";
import * as SecureStore from "expo-secure-store";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { apiUrl, request } from "@/lib/http";
import { SafeToSpendWidget } from "./safe-to-spend-widget";
import {
  readPendingDeletes,
  readPendingLogs,
  readWidgetCache,
  type WidgetCache,
  writePendingDeletes,
  writePendingLogs,
  writeWidgetCache,
} from "./widget-cache";
import { afterLog, afterUndo, canUndo } from "./widget-quick-log";

export const WIDGET_NAME = "SafeToSpend";

async function authHeader() {
  return { authorization: `Bearer ${(await SecureStore.getItemAsync("tt.token")) ?? ""}` };
}

/** Logs "cha 20" without opening the app; offline taps wait for the app to send them. */
async function logQuickEntry(index: number): Promise<WidgetCache> {
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
  let queued = false;
  try {
    const response = await request(apiUrl("/transactions"), {
      method: "POST",
      headers: await authHeader(),
      json: { ...log, type: "expense" },
    });
    if (!response.ok) throw new Error(String(response.status));
  } catch {
    await writePendingLogs([...(await readPendingLogs()), log]);
    queued = true;
  }
  const next = afterLog(cache, entry, { id: log.id, queued }, Date.now());
  await writeWidgetCache(next);
  return next;
}

/** Takes back the last quick-log: drops it from the waiting list, or deletes it on the server. */
async function undoQuickLog(): Promise<WidgetCache> {
  const cache = await readWidgetCache();
  const log = cache.lastLog;
  if (!log || !canUndo(cache, Date.now())) {
    const next = { ...cache, lastLog: null, status: "Too late to undo here. Delete it in Money." };
    await writeWidgetCache(next);
    return next;
  }
  const pending = await readPendingLogs();
  if (pending.some((p) => p.id === log.id)) {
    await writePendingLogs(pending.filter((p) => p.id !== log.id));
  } else {
    try {
      const response = await request(apiUrl(`/transactions/${log.id}`), {
        method: "DELETE",
        headers: await authHeader(),
      });
      // 404: already gone, which is what Undo wants.
      if (!response.ok && response.status !== 404) throw new Error(String(response.status));
    } catch {
      await writePendingDeletes([...(await readPendingDeletes()), log.id]);
    }
  }
  const next = afterUndo(cache);
  await writeWidgetCache(next);
  return next;
}

/** "Keep": hides the Undo row so the quick-log buttons come back. */
async function keepLastLog(): Promise<WidgetCache> {
  const next = { ...(await readWidgetCache()), lastLog: null };
  await writeWidgetCache(next);
  return next;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== WIDGET_NAME || props.widgetAction === "WIDGET_DELETED")
    return;
  let cache = await readWidgetCache();
  if (props.widgetAction === "WIDGET_CLICK") {
    if (props.clickAction === "LOG")
      cache = await logQuickEntry(Number(props.clickActionData?.index ?? -1));
    else if (props.clickAction === "UNDO_LOG") cache = await undoQuickLog();
    else if (props.clickAction === "KEEP_LOG") cache = await keepLastLog();
  }
  const height = props.widgetInfo.height;
  const now = Date.now();
  props.renderWidget({
    light: <SafeToSpendWidget cache={cache} scheme="light" height={height} now={now} />,
    dark: <SafeToSpendWidget cache={cache} scheme="dark" height={height} now={now} />,
  });
}
