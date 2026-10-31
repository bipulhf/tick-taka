import { useNavigate } from "@tanstack/react-router";
import { splitOfferMinor } from "@tick-taka/shared/payday";
import { useCallback } from "react";
import { useSettings } from "@/lib/queries";

/** What "Received" offers next: split the pay in Budgets, pre-filled with the amount. */
export interface SplitOffer {
  amountMinor: number;
  open: () => void;
}

/** The split offer for a recurring item, or undefined for a bill or foreign income. */
export function useSplitOffer() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const defaultCurrency = settings?.defaultCurrency ?? "BDT";
  return useCallback(
    (item: { income: boolean; amountMinor: number; currency: string }): SplitOffer | undefined => {
      const amountMinor = splitOfferMinor(item, defaultCurrency);
      if (amountMinor === null) return undefined;
      return {
        amountMinor,
        open: () =>
          void navigate({ to: "/money/budgets", search: { split: true, amount: amountMinor } }),
      };
    },
    [navigate, defaultCurrency],
  );
}
