/**
 * Whether Today's one-tap "Paid" / "Received" can't go straight to the server: the
 * bill is in another currency than the account it moves through, so the server
 * needs a rate or the amount received. Then the bill sheet opens to ask. Pure.
 */
export function payNeedsRate(
  item: { currency: string; accountId?: string | null },
  accounts: { id: string; currency: string }[] | undefined,
  settings: { defaultAccountId: string | null; defaultCurrency: string } | undefined,
): boolean {
  const accountId = item.accountId ?? settings?.defaultAccountId ?? null;
  const account = accounts?.find((a) => a.id === accountId);
  return item.currency !== (account?.currency ?? settings?.defaultCurrency ?? "BDT");
}
