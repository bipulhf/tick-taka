import { splitOfferMessage, splitOfferMinor } from "@tick-taka/shared/payday";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { formatAmount } from "@/lib/format";
import { notify } from "@/lib/notify";
import { privacyStore } from "@/lib/privacy";
import { useSettings } from "@/lib/queries";

/** What "Received" offers next: split the pay in Budgets, pre-filled with the amount. */
export interface SplitOffer {
  amountMinor: number;
  open: () => void;
}

/** The split offer for a recurring item, or undefined for a bill or foreign income. */
export function useSplitOffer() {
  const router = useRouter();
  const { data: settings } = useSettings();
  const defaultCurrency = settings?.defaultCurrency ?? "BDT";
  return useCallback(
    (item: { income: boolean; amountMinor: number; currency: string }): SplitOffer | undefined => {
      const amountMinor = splitOfferMinor(item, defaultCurrency);
      if (amountMinor === null) return undefined;
      return {
        amountMinor,
        open: () => router.push(`/money/budgets?split=1&amount=${amountMinor}`),
      };
    },
    [router, defaultCurrency],
  );
}

/** "Salary logged" with Undo, and "Split" beside it when a received income offers one. */
export function notifyLogged(name: string, undo: () => void, offer?: SplitOffer): void {
  const undoAction = {
    label: "Undo",
    onPress: () => {
      // Saved like any change: it holds even if the app closes before syncing.
      undo();
      notify(`Took back ${name}`);
    },
  };
  if (!offer) {
    notify(`${name} logged`, undoAction);
    return;
  }
  notify(
    splitOfferMessage(
      name,
      privacyStore.get() ? null : formatAmount(offer.amountMinor, { signed: false }),
    ),
    undoAction,
    { label: "Split", onPress: offer.open },
  );
}
