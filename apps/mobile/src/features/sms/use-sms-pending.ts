import { useToday } from "@/lib/queries";

/** Cards waiting in the SMS review panel. The phone-side scanner adds to this in a later step. */
export function useSmsPendingCount(): number {
  return useToday().data?.counts.smsPending ?? 0;
}
