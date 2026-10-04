import { onSmsReceived } from "@modules/sms-reader";
import { formatAmount } from "@tick-taka/shared/money";
import type { QuickAddContext } from "@tick-taka/shared/quick-add";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useReference } from "@/lib/queries";
import { ingest, scanSms } from "./scanner";
import { loadSmsCards, type SmsCard } from "./sms-store";

export const SMS_CATEGORY = "sms-card";

async function notifyCard(card: SmsCard) {
  const verb =
    card.kind === "income"
      ? "add as income?"
      : card.kind === "transfer"
        ? "add as cash-out?"
        : "add as expense?";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${card.sender} · ${formatAmount(card.parsed.amountMinor)} ${card.parsed.direction === "in" ? "received" : "payment"}`,
      body: verb[0]!.toUpperCase() + verb.slice(1),
      categoryIdentifier: SMS_CATEGORY,
      data: {
        url: `/money/sms?action=review&receivedAt=${card.receivedAt}`,
        addUrl: `/money/sms?action=add&receivedAt=${card.receivedAt}`,
      },
    },
    trigger: null,
  });
}

/** Returns a function that scans the inbox now and resolves to the number of new cards. */
export function useSmsScan() {
  const reference = useReference();
  const latest = useRef(reference);
  latest.current = reference;
  return useCallback(async () => {
    const { settings, accounts, categories, areas, rules } = latest.current;
    if (!settings) return 0;
    const context: QuickAddContext = {
      now: Date.now(),
      timeZone: settings.timeZone,
      accounts,
      defaultAccountId: settings.defaultAccountId,
      categories,
      areas,
      rules,
    };
    const cards = await scanSms(settings, context, accounts);
    return cards.length;
  }, []);
}

/**
 * Scan-on-open plus the live receiver: each time the app opens it reads allowed
 * messages since the last scan; while open, new SMS arrive as events.
 */
export function useSmsCapture() {
  const reference = useReference();
  const scan = useSmsScan();
  const ready = reference.ready;
  const latest = useRef(reference);
  latest.current = reference;

  useEffect(() => {
    void loadSmsCards();
    void Notifications.setNotificationCategoryAsync(SMS_CATEGORY, [
      { identifier: "add", buttonTitle: "Add", options: { opensAppToForeground: true } },
      { identifier: "review", buttonTitle: "Review", options: { opensAppToForeground: true } },
    ]);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void scan();
    const appState = AppState.addEventListener("change", (status) => {
      if (status === "active") void scan();
    });
    const live = onSmsReceived(async (sms) => {
      const { settings, accounts, categories, areas, rules } = latest.current;
      if (!settings) return;
      const context: QuickAddContext = {
        now: Date.now(),
        timeZone: settings.timeZone,
        accounts,
        defaultAccountId: settings.defaultAccountId,
        categories,
        areas,
        rules,
      };
      const cards = await ingest(
        [{ id: String(sms.receivedAt), ...sms }],
        settings,
        context,
        accounts,
      );
      for (const card of cards) await notifyCard(card);
    });
    return () => {
      appState.remove();
      live?.remove();
    };
  }, [ready, scan]);
}
