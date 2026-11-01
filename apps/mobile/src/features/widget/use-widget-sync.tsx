import { addDays, localMonthRange, startOfLocalDay } from "@tick-taka/shared/dates";
import { liveDefaultAccountId } from "@tick-taka/shared/quick-add";
import { useEffect } from "react";
import { useBudgets, useInsights, useTransactions } from "@/features/money/queries";
import { useRecurring, useTasks } from "@/features/plan/queries";
import { outbox, startOutbox, useOutbox } from "@/lib/outbox";
import { usePrivacy } from "@/lib/privacy";
import { useAccounts, useAiStatus, useCategories, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useToday, useTodayDate } from "@/lib/use-today";
import { resetOnSignOut } from "@/lib/user-data";
import { userTime } from "@/lib/user-time";
import {
  EMPTY_CACHE,
  pickQuickEntries,
  readPendingDeletes,
  readPendingLogs,
  readPendingRequests,
  readWidgetCache,
  removePendingDeletes,
  removePendingLogs,
  removePendingRequests,
  type WidgetCache,
  writeWidgetCache,
} from "./widget-cache";
import { handOverWidgetWrites } from "./widget-pending";
import { refreshWidgets } from "./widget-registry";
import {
  otherDays,
  todayTasks,
  widgetAssistant,
  widgetBills,
  widgetFocus,
  widgetHabits,
  widgetMonth,
} from "./widget-snapshot";

// The widgets show nothing of a signed-out user.
resetOnSignOut(() => {
  void refreshWidgets(EMPTY_CACHE).catch(() => {});
});

/**
 * Keeps the widgets' cached numbers fresh after every change in the app, and hands
 * writes tapped on them while offline to the outbox.
 */
export function useWidgetSync() {
  const send = useOutbox();
  const today = useToday();
  const date = useTodayDate();
  const { data: settings } = useSettings();
  const { timeZone } = userTime(settings);
  const month = date.slice(0, 7);
  const range = localMonthRange(month, timeZone);
  const recent = useTransactions({ type: "expense", limit: "200" });
  const { data: ai } = useAiStatus();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: recurring } = useRecurring();
  const { data: budgets } = useBudgets(month);
  const { data: insights } = useInsights(range.from, range.to);
  // Open tasks before the day after tomorrow: earlier days' and tomorrow's.
  const { data: open } = useTasks({
    status: "inbox,open",
    to: String(startOfLocalDay(addDays(date, 2), timeZone)),
    limit: "200",
  });
  const hidden = usePrivacy();

  useEffect(() => {
    void handOverWidgetWrites({
      ready: startOutbox,
      readLogs: readPendingLogs,
      removeLogs: removePendingLogs,
      readDeletes: readPendingDeletes,
      removeDeletes: removePendingDeletes,
      readRequests: readPendingRequests,
      removeRequests: removePendingRequests,
      send,
      durable: () => outbox.durable(),
    }).catch((error: unknown) => console.warn("widget: couldn't hand over offline taps", error));
  }, [send]);

  useEffect(() => {
    const data = today.data;
    if (!data) return;
    const transactions = recent.data?.pages.flatMap((p) => p.items) ?? [];
    void (async () => {
      const previous = await readWidgetCache();
      const now = Date.now();
      const currency = settings?.defaultCurrency ?? previous.currency;
      const tasks = todayTasks(data);
      const focusMinutes = settings?.focus.workMinutes ?? previous.focusMinutes;
      const emojiOf = (id: string | null) =>
        categories?.find((category) => category.id === id)?.emoji ?? null;
      const live = accounts;
      const cache: WidgetCache = {
        ...previous,
        signedIn: true,
        date: data.date,
        timeZone,
        leftTodayMinor: data.safeToSpend.hasBudgets ? data.safeToSpend.leftTodayMinor : null,
        spentTodayMinor: data.safeToSpend.spentTodayMinor,
        dailyMinor: data.safeToSpend.dailyMinor,
        tasks,
        ...(open ? otherDays(open, data.date, timeZone) : {}),
        habits: widgetHabits(data.habits),
        ...(recurring ? widgetBills(recurring, data.date, currency) : {}),
        month: widgetMonth(month, insights, budgets, previous.month),
        focusMinutes,
        focus: widgetFocus(data.runningTimer, {
          minutes: focusMinutes,
          tasks,
          previous: previous.focus,
          fetchedAt: today.dataUpdatedAt,
          now,
        }),
        // As in quick-add: a deleted default falls back to the first account left, or none.
        accountId: live
          ? liveDefaultAccountId(settings?.defaultAccountId, live)
          : previous.accountId,
        accounts: live
          ? live.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))
          : previous.accounts,
        currency,
        quick: transactions.length ? pickQuickEntries(transactions, 4, emojiOf) : previous.quick,
        // A tap's Undo and note stay while the app refreshes.
        numerals: settings?.numerals ?? "latn",
        hidden,
        assistant: widgetAssistant(ai, previous.assistant),
        updatedAt: editTime(),
      };
      await writeWidgetCache(cache);
      await refreshWidgets(cache);
    })();
  }, [
    today.data,
    today.dataUpdatedAt,
    recent.data,
    settings,
    accounts,
    categories,
    recurring,
    budgets,
    insights,
    open,
    month,
    timeZone,
    ai,
    hidden,
  ]);
}
