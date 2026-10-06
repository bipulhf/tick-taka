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
  readPendingLogs,
  readWidgetCache,
  type WidgetCache,
  writePendingLogs,
  writeWidgetCache,
} from "./widget-cache";
import { widgetSnapshot } from "./widget-snapshot";
import { WIDGET_NAME } from "./widget-task-handler";

// The widget shows nothing of a signed-out user.
resetOnSignOut(() => {
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => ({
      light: <SafeToSpendWidget cache={EMPTY_CACHE} scheme="light" height={info.height} />,
      dark: <SafeToSpendWidget cache={EMPTY_CACHE} scheme="dark" height={info.height} />,
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
      if (pending.length === 0) return;
      for (const log of pending)
        send({ method: "POST", path: "/transactions", body: { ...log, type: "expense" } });
      await writePendingLogs([]);
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
        updatedAt: editTime(),
      };
      await writeWidgetCache(cache);
      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: (info) => ({
          light: <SafeToSpendWidget cache={cache} scheme="light" height={info.height} />,
          dark: <SafeToSpendWidget cache={cache} scheme="dark" height={info.height} />,
        }),
      }).catch(() => {});
    })();
  }, [today.data, recent.data, settings?.defaultAccountId, timeZone]);
}
