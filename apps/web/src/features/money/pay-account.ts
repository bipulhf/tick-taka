/** An account as the pay flow needs it. */
export interface PayAccount {
  id: string;
  name: string;
  deletedAt?: number | null;
  archivedAt?: number | null;
}

/**
 * What a "Paid" or "Received" needs before it can be sent. The server uses the bill's
 * own account, else the default account, and refuses with "Pick the account this was
 * paid from" when neither is set (or either was deleted): this decides it first, so the
 * user is asked instead of shown that refusal.
 */
export type PayAccountNeed =
  | { kind: "ready" }
  | { kind: "no-accounts" }
  | { kind: "only"; accountId: string }
  | { kind: "ask"; accounts: PayAccount[] };

export function payAccountNeed(input: {
  billAccountId: string | null | undefined;
  defaultAccountId: string | null | undefined;
  accounts: PayAccount[];
}): PayAccountNeed {
  const live = input.accounts.filter((a) => !a.deletedAt && !a.archivedAt);
  const usable = (id: string | null | undefined) => !!id && live.some((a) => a.id === id);
  if (usable(input.billAccountId) || usable(input.defaultAccountId)) return { kind: "ready" };
  if (live.length === 0) return { kind: "no-accounts" };
  const only = live.length === 1 ? live[0] : undefined;
  if (only) return { kind: "only", accountId: only.id };
  return { kind: "ask", accounts: live };
}
