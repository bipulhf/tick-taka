import { onSmsReceived } from "@modules/sms-reader";
import { onlineManager } from "@tanstack/react-query";
import { formatAmount } from "@tick-taka/shared/money";
import type { QuickAddContext } from "@tick-taka/shared/quick-add";
import type { Settings } from "@tick-taka/shared/schemas/settings";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api, unwrap } from "@/lib/api";
import { keys, useReference } from "@/lib/queries";
import { queryClient } from "@/lib/query-client";
import { scanSms } from "./scanner";
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
      title: `${card.sender} · ${formatAmount(card.parsed.amountMinor)} ${card.parsed.direction === "in" ? "received" : card.kind === "transfer" ? "cash out" : "payment"}`,
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

/** Settings straight from the server when online, so a just-added sender is never missed. */
async function freshSettings(cached: Settings | undefined): Promise<Settings | undefined> {
  if (!onlineManager.isOnline()) return cached;
  try {
    return await queryClient.fetchQuery({
      queryKey: keys.settings,
      queryFn: () => unwrap(api.settings.$get()),
      staleTime: 0,
    });
  } catch {
    return cached;
  }
}

/** Returns a function that scans the inbox now and resolves to the new cards. */
export function useSmsScan() {
  const reference = useReference();
  const latest = useRef(reference);
  latest.current = reference;
  return useCallback(async (): Promise<SmsCard[]> => {
    const { accounts, categories, areas, rules } = latest.current;
    const settings = await freshSettings(latest.current.settings);
    if (!settings) return [];
    const context: QuickAddContext = {
      now: Date.now(),
      timeZone: settings.timeZone,
      accounts,
      defaultAccountId: settings.defaultAccountId,
      categories,
      areas,
      rules,
    };
    return scanSms(settings, context, accounts);
  }, []);
}

/**
 * Scan-on-open plus the live receiver. A new SMS while the app is open triggers the
 * same inbox scan (so the scan cursor stays honest) and a notification per new card.
 */
export function useSmsCapture() {
  const reference = useReference();
  const scan = useSmsScan();
  const ready = reference.ready;

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
    const live = onSmsReceived(async () => {
      // The provider may not have stored the message yet when the broadcast arrives.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      for (const card of await scan()) await notifyCard(card);
    });
    return () => {
      appState.remove();
      live?.remove();
    };
  }, [ready, scan]);
}
