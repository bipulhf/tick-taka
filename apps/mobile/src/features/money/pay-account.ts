import { liveDefaultAccountId } from "@tick-taka/shared/quick-add";
import type { OutboxRequest } from "@/lib/outbox-policy";

/**
 * Which account a "Paid" / "Received" goes through, before it is queued:
 * - pay: send it with this account. `remember` also sets it on the bill, so the next
 *   one goes through without asking (it was the only account left).
 * - pick: ask which account, from these.
 * - add-account: there is no account at all, so one has to be added first.
 */
export type PayAccount =
  | { kind: "pay"; accountId: string | undefined; remember: boolean }
  | { kind: "pick"; accounts: { id: string; name: string }[] }
  | { kind: "add-account" };

/**
 * The server pays from the chosen account, else the bill's, else Settings' default,
 * and refuses when that is unset or deleted. So a pay never goes out blind: an account
 * that no longer exists (not in the live list) counts as unset. Until the account list
 * has loaded, it goes with what the bill and Settings name. Pure.
 */
export function payAccount(input: {
  /** An account the caller already picked (the bill sheet's Account field). */
  chosen?: string | null;
  billAccountId: string | null;
  defaultAccountId: string | null | undefined;
  /** Live accounts (deleted and archived ones left out); undefined until loaded. */
  accounts: { id: string; name: string }[] | undefined;
}): PayAccount {
  const { chosen, billAccountId, defaultAccountId, accounts } = input;
  if (!accounts) {
    const known = chosen ?? billAccountId ?? defaultAccountId ?? undefined;
    return { kind: "pay", accountId: known, remember: false };
  }
  const live = (id: string | null | undefined): id is string =>
    Boolean(id) && accounts.some((a) => a.id === id);
  if (live(chosen)) return { kind: "pay", accountId: chosen, remember: false };
  if (live(billAccountId)) return { kind: "pay", accountId: billAccountId, remember: false };
  const fallback = liveDefaultAccountId(defaultAccountId, accounts);
  if (fallback === null) return { kind: "add-account" };
  if (fallback === defaultAccountId) return { kind: "pay", accountId: fallback, remember: false };
  if (accounts.length === 1) return { kind: "pay", accountId: fallback, remember: true };
  return { kind: "pick", accounts: accounts.map((a) => ({ id: a.id, name: a.name })) };
}

/** "Use Cash for Rent from now on": sets the account on the bill, queued before its pay. */
export function rememberAccountRequest(
  item: { id: string; name: string },
  accountId: string,
  updatedAt: number,
): OutboxRequest {
  return {
    method: "PATCH",
    path: `/recurring/${item.id}`,
    body: { accountId, updatedAt },
    label: `Couldn't save the account for ${item.name}`,
  };
}
