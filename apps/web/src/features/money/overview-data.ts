import { addDays } from "@tick-taka/shared/dates";

/** What the Money overview works out from data it already has. Pure, so it can be tested. */

export interface RankedEntry {
  /** A category id; null is uncategorised spending. */
  id: string | null;
  amountMinor: number;
  /** The rest, summed: "Other". */
  other?: true;
}

/**
 * The biggest `count` entries of a ranked list (largest first) and the rest summed as
 * one "Other" entry, left out when there is no rest.
 */
export function topWithOther(ranked: [string | null, number][], count = 5): RankedEntry[] {
  const top: RankedEntry[] = ranked
    .slice(0, count)
    .map(([id, amountMinor]) => ({ id, amountMinor }));
  const rest = ranked.slice(count).reduce((sum, [, amount]) => sum + amount, 0);
  return rest > 0 ? [...top, { id: null, amountMinor: rest, other: true }] : top;
}

/**
 * Bills and paydays due within `days` of today (late ones included), soonest first.
 */
export function comingUp<R extends { dueDate: string }>(items: R[], today: string, days = 7): R[] {
  const last = addDays(today, days);
  return items
    .filter((item) => item.dueDate <= last)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * The net of what's coming up, in one currency: income adds, bills take away. Items in
 * other currencies are left out rather than mixed in.
 */
export function comingUpNet(
  items: { kind: string; amountMinor: number; currency: string }[],
  currency: string,
): number {
  return items
    .filter((item) => item.currency === currency)
    .reduce(
      (sum, item) => sum + (item.kind === "income" ? item.amountMinor : -item.amountMinor),
      0,
    );
}
