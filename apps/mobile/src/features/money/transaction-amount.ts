/** The fields of a transaction that decide how its amount is shown. */
export interface AmountSource {
  type: string;
  amountMinor: number;
  toAmountMinor?: number | null;
  toAccountId?: string | null;
}

export interface AmountDisplay {
  /** Negative for money out, so the amount prints with a leading minus. */
  minor: number;
  /** Print a leading + for money in. */
  signed: boolean;
  tone: "mint" | "coral" | "ink";
  /** Transfers between your own accounts get a transfer icon instead of a colour. */
  transfer: boolean;
}

/**
 * Colour is never the only cue: money out reads "−৳120", money in "+৳45,000".
 * A transfer is neutral ink with a transfer icon; seen from one of its two accounts
 * it carries the sign for that account ("+" arriving, "−" leaving).
 */
export function transactionAmount(tx: AmountSource, perspectiveAccountId?: string): AmountDisplay {
  if (tx.type === "transfer") {
    if (!perspectiveAccountId) {
      return { minor: Math.abs(tx.amountMinor), signed: false, tone: "ink", transfer: true };
    }
    const arriving = perspectiveAccountId === tx.toAccountId;
    const minor = arriving
      ? Math.abs(tx.toAmountMinor ?? tx.amountMinor)
      : -Math.abs(tx.amountMinor);
    return { minor, signed: arriving, tone: "ink", transfer: true };
  }
  const incoming = tx.type === "income" || (tx.type === "adjustment" && tx.amountMinor > 0);
  return incoming
    ? { minor: Math.abs(tx.amountMinor), signed: true, tone: "mint", transfer: false }
    : { minor: -Math.abs(tx.amountMinor), signed: false, tone: "coral", transfer: false };
}
