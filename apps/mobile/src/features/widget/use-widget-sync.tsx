import { useEffect } from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { useTransactions } from "@/features/money/queries";
import { useOutbox } from "@/lib/outbox";
import { useSettings, useToday } from "@/lib/queries";
import { resetOnSignOut } from "@/lib/user-data";
import { SafeToSpendWidget } from "./safe-to-spend-widget";
import {
  EMPTY_CACHE,
  pickQuickEntries,
  readPendingLogs,
  readWidgetCache,
  writePendingLogs,
  writeWidgetCache,
} from "./widget-cache";
import { WIDGET_NAME } from "./widget-task-handler";

// The widget shows nothing of a signed-out user.
resetOnSignOut(() => {
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => ({
      light: <SafeToSpendWidget cache={EMPTY_CACHE} scheme="light" />,
      dark: <SafeToSpendWidget cache={EMPTY_CACHE} scheme="dark" />,
    }),
  }).catch(() => {});
});

/** Keeps the widget's cached numbers fresh and sends any logs tapped while offline. */
export function useWidgetSync() {
  const send = useOutbox();
  const today = useToday();
  const { data: settings } = useSettings();
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
    if (!today.data) return;
    const money = today.data.safeToSpend;
    const transactions = recent.data?.pages.flatMap((p) => p.items) ?? [];
    void (async () => {
      const previous = await readWidgetCache();
      const cache = {
        leftTodayMinor: money.hasBudgets ? money.leftTodayMinor : null,
        accountId: settings?.defaultAccountId ?? null,
        quick: transactions.length ? pickQuickEntries(transactions) : previous.quick,
        status: null,
        updatedAt: Date.now(),
      };
      await writeWidgetCache(cache);
      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: () => ({
          light: <SafeToSpendWidget cache={cache} scheme="light" />,
          dark: <SafeToSpendWidget cache={cache} scheme="dark" />,
        }),
      }).catch(() => {});
    })();
  }, [today.data, recent.data, settings?.defaultAccountId]);
}
