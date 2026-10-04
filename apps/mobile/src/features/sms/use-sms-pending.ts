import { useSmsCards } from "./sms-store";

/** Cards waiting in the SMS review panel. */
export function useSmsPendingCount(): number {
  return useSmsCards().filter((card) => card.status === "pending").length;
}
