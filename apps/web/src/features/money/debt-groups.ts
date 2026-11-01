/** Pure rules behind the debts view. */

interface DebtLike {
  direction: "owed_to_me" | "i_owe";
  closedAt: number | null;
  outstandingMinor: number;
}

/** Open loans, split into who owes me and whom I owe, in the phone's order. */
export function openDebtGroups<T extends DebtLike>(debts: T[]): { title: string; items: T[] }[] {
  const open = debts.filter((d) => d.closedAt === null);
  return [
    { title: "Owed to me", items: open.filter((d) => d.direction === "owed_to_me") },
    { title: "I owe", items: open.filter((d) => d.direction === "i_owe") },
  ];
}

/**
 * The outstanding amount with its sign, so colour is never the only cue: money owed to
 * me is coming in (+), money I owe is going out (−).
 */
export function signedOutstanding(debt: DebtLike): number {
  const amount = Math.abs(debt.outstandingMinor);
  return debt.direction === "owed_to_me" ? amount : -amount;
}

/** How much of the loan is repaid, 0 to 1. */
export function repaidShare(repaidMinor: number, principalMinor: number): number {
  return principalMinor > 0 ? Math.min(1, repaidMinor / principalMinor) : 0;
}

/**
 * The strip's totals for open loans in one currency: what's owed to me, what I owe, and
 * the net (owed to me minus what I owe). Loans in other currencies are left out.
 */
export function debtTotals(
  debts: (DebtLike & { currency: string })[],
  currency: string,
): { owedToMeMinor: number; iOweMinor: number; netMinor: number } {
  let owedToMeMinor = 0;
  let iOweMinor = 0;
  for (const debt of debts) {
    if (debt.closedAt !== null || debt.currency !== currency) continue;
    const amount = Math.max(0, debt.outstandingMinor);
    if (debt.direction === "owed_to_me") owedToMeMinor += amount;
    else iOweMinor += amount;
  }
  return { owedToMeMinor, iOweMinor, netMinor: owedToMeMinor - iOweMinor };
}

/** Settled loans, the latest first. */
export function settledDebts<T extends DebtLike>(debts: T[]): T[] {
  return debts
    .filter((d) => d.closedAt !== null)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
}
