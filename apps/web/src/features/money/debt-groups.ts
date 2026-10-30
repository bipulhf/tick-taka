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
