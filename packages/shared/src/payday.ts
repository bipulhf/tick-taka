/**
 * "Split this ৳45,000?" after a recurring income is marked Received: the amount the
 * offer pre-fills in the payday split, or null when there is nothing to offer (a bill,
 * or income in another currency than the budgets'). Pure.
 */
export function splitOfferMinor(
  item: { income: boolean; amountMinor: number; currency: string },
  defaultCurrency: string,
): number | null {
  if (!item.income || item.currency !== defaultCurrency) return null;
  return item.amountMinor > 0 ? item.amountMinor : null;
}

/** The toast after Received with a split offer; the amount stays out when amounts are hidden. */
export function splitOfferMessage(name: string, amount: string | null): string {
  return amount ? `${name} logged. Split this ${amount}?` : `${name} logged. Split it?`;
}
