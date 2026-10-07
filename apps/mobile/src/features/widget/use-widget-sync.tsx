import { useEffect } from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { useTransactions } from "@/features/money/queries";
import { useOutbox } from "@/lib/outbox";
import { useSettings, useToday } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { resetOnSignOut } from "@/lib/user-data";
import { userTime } from "@/lib/user-time";
import { SafeToSpendWidget } from "./safe-to-spend-widget";
import {
  EMPTY_CACHE,
  pickQuickEntries,
  readPendingDeletes,
  readPendingLogs,
  readWidgetCache,
  removePendingDeletes,
  removePendingLogs,
  type WidgetCache,
  writeWidgetCache,
} from "./widget-cache";
import { widgetSnapshot } from "./widget-snapshot";
import { WIDGET_NAME } from "./widget-task-handler";

// The widget shows nothing of a signed-out user.
resetOnSignOut(() => {
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => ({
      light: (
        <SafeToSpendWidget
          cache={EMPTY_CACHE}
          scheme="light"
          width={info.width}
          height={info.height}
        />
      ),
      dark: (
        <SafeToSpendWidget
          cache={EMPTY_CACHE}
          scheme="dark"
          width={info.width}
          height={info.height}
        />
      ),
    }),
  }).catch(() => {});
});

/** Keeps the widget's cached numbers fresh and sends any logs tapped while offline. */
export function useWidgetSync() {
  const send = useOutbox();
  const today = useToday();
  const { data: settings } = useSettings();
  const { timeZone } = userTime(settings);
  const recent = useTransactions({ type: "expense", limit: "200" });

  useEffect(() => {
    void (async () => {
      const pending = await readPendingLogs();
      for (const log of pending)
        send({ method: "POST", path: "/transactions", body: { ...log, type: "expense" } });
      if (pending.length) await removePendingLogs(pending);
      // Quick-logs undone on the widget while it couldn't reach the server.
      const deletes = await readPendingDeletes();
      for (const id of deletes) send({ method: "DELETE", path: `/transactions/${id}` });
      if (deletes.length) await removePendingDeletes(deletes);
    })();
  }, [send]);

  useEffect(() => {
    const data = today.data;
    if (!data) return;
    const transactions = recent.data?.pages.flatMap((p) => p.items) ?? [];
    void (async () => {
      const previous = await readWidgetCache();
      const cache: WidgetCache = {
        signedIn: true,
        ...widgetSnapshot(data, Date.now(), timeZone),
        accountId: settings?.defaultAccountId ?? null,
        quick: transactions.length ? pickQuickEntries(transactions) : previous.quick,
        status: null,
        // The widget keeps offering Undo for its last quick-log while the app refreshes.
        lastLog: previous.lastLog,
        numerals: settings?.numerals ?? "latn",
        updatedAt: editTime(),
      };
      await writeWidgetCache(cache);
      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: (info) => ({
          light: (
            <SafeToSpendWidget
              cache={cache}
              scheme="light"
              width={info.width}
              height={info.height}
            />
          ),
          dark: (
            <SafeToSpendWidget
              cache={cache}
              scheme="dark"
              width={info.width}
              height={info.height}
            />
          ),
        }),
      }).catch(() => {});
    })();
  }, [today.data, recent.data, settings?.defaultAccountId, settings?.numerals, timeZone]);
}
