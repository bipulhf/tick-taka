/**
 * The Accounts view's groups and totals. Totals add up only accounts in the default
 * currency, so amounts in other currencies are never mixed in. Pure, so it can be tested.
 */

export interface AccountLike {
  type: string;
  currency: string;
  balanceMinor: number;
}

export type AccountGroupKey = "cash" | "bank" | "cards";

export const ACCOUNT_GROUPS: { key: AccountGroupKey; title: string; types: string[] }[] = [
  { key: "cash", title: "Cash and wallets", types: ["cash", "mobile_wallet"] },
  { key: "bank", title: "Bank and savings", types: ["bank", "savings"] },
  { key: "cards", title: "Cards", types: ["card"] },
];

/** The group an account type belongs to; anything unknown counts as cash. */
export function groupOf(type: string): AccountGroupKey {
  return ACCOUNT_GROUPS.find((g) => g.types.includes(type))?.key ?? "cash";
}

/** The accounts of each group (empty groups left out) with the group's total. */
export function groupAccounts<A extends AccountLike>(accounts: A[], currency: string) {
  return ACCOUNT_GROUPS.map((group) => {
    const members = accounts.filter((a) => groupOf(a.type) === group.key);
    return { ...group, accounts: members, totalMinor: totalIn(members, currency) };
  }).filter((group) => group.accounts.length > 0);
}

export function totalIn(accounts: AccountLike[], currency: string): number {
  return accounts
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
}

/** What the cards owe, as a positive amount (zero when none are below zero). */
export function cardsOwed(accounts: AccountLike[], currency: string): number {
  return accounts
    .filter((a) => groupOf(a.type) === "cards" && a.currency === currency && a.balanceMinor < 0)
    .reduce((sum, a) => sum - a.balanceMinor, 0);
}

/**
 * An account's share of everything you have (the positive balances in the currency),
 * 0 to 1; null for an account in debt or in another currency, which has no share.
 */
export function shareOfTotal(
  account: AccountLike,
  accounts: AccountLike[],
  currency: string,
): number | null {
  if (account.currency !== currency || account.balanceMinor <= 0) return null;
  const assets = accounts
    .filter((a) => a.currency === currency && a.balanceMinor > 0)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  return assets > 0 ? account.balanceMinor / assets : null;
}
