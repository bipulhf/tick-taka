import { newId } from "@tick-taka/shared/ids";
import { splitOfferMessage } from "@tick-taka/shared/payday";
import { api, unwrap } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { privacyStore } from "@/lib/prefs";
import { keys } from "@/lib/queries";
import { queryClient } from "@/lib/query-client";
import { notify, notifyError } from "@/lib/toast";
import { fire, type WriteRequest, write } from "@/lib/write";
import { payAccountNeed } from "./pay-account";
import { pickPayAccount } from "./pay-account-picker";
import type { SplitOffer } from "./split-offer";

/** What a "Paid" / "Received" / "Skip" sends, as far as its Undo needs it. */
export interface PayBody extends Record<string, unknown> {
  /** Made here, so the Undo can name the transaction before the reply. */
  transactionId: string;
  /** The due date (next_due_at) this pays; the Undo moves the bill back to it. */
  dueAt: number;
  skip?: boolean;
}

/**
 * The write that takes back a pay or skip (POST /recurring/:id/unpay). It needs nothing
 * from the pay's reply: the server deletes the transaction the pay logged, if any, and
 * moves the due date back only if that pay is what moved it.
 */
export function unpayRequest(item: { id: string; name: string }, body: PayBody): WriteRequest {
  return {
    method: "POST",
    path: `/recurring/${item.id}/unpay`,
    body: { transactionId: body.transactionId, dueAt: body.dueAt, skip: body.skip ?? false },
    label: `Couldn't undo ${item.name}`,
  };
}

/**
 * Pays (or skips) a bill or income, then offers Undo in a toast. `extra` carries the
 * panel's choices (account, amount, rate) when the pay came from there; `split` is a
 * received income's "Split this ৳X?" (from `useSplitOffer`), offered beside Undo.
 */
export async function payRecurring(
  item: { id: string; name: string; dueAt: number },
  options: { skip?: boolean; extra?: Record<string, unknown>; split?: SplitOffer } = {},
): Promise<void> {
  const accountId =
    options.skip || options.extra?.accountId ? undefined : await accountForPay(item);
  if (accountId === null) return;
  const body: PayBody = {
    ...options.extra,
    ...(accountId ? { accountId } : {}),
    transactionId: newId(),
    // The due date it pays: a double click then finds the bill already moved past it
    // and changes nothing, and Undo moves the bill back to it.
    dueAt: item.dueAt,
    ...(options.skip ? { skip: true } : {}),
  };
  await write({
    method: "POST",
    path: `/recurring/${item.id}/pay`,
    body,
    label: `Couldn't log ${item.name}`,
  });
  const undo = {
    label: "Undo",
    onPress: () => {
      fire(unpayRequest(item, body));
      notify(`Took back ${item.name}`);
    },
  };
  const split = options.skip ? undefined : options.split;
  if (split)
    notify(
      splitOfferMessage(
        item.name,
        privacyStore.get() ? null : formatAmount(split.amountMinor, { signed: false }),
      ),
      undo,
      { label: "Split", onPress: split.open },
    );
  else notify(options.skip ? `Skipped ${item.name}` : `${item.name} logged`, undo);
}

/**
 * The account to send with a pay when the server couldn't pick one itself (the bill has
 * none and there's no default account): asked in a dialog, or the only account there is.
 * Undefined when the server can pick; null when the user cancelled or has no account.
 */
async function accountForPay(item: {
  id: string;
  name: string;
}): Promise<string | null | undefined> {
  const [settings, accounts, bill] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: keys.settings,
      queryFn: () => unwrap(api.settings.$get()),
      staleTime: 30_000,
    }),
    queryClient.fetchQuery({
      queryKey: keys.accounts,
      queryFn: () => unwrap(api.accounts.$get({ query: {} })),
      staleTime: 30_000,
    }),
    unwrap(api.recurring[":id"].$get({ param: { id: item.id } })),
  ]);
  const need = payAccountNeed({
    billAccountId: bill.accountId,
    defaultAccountId: settings.defaultAccountId,
    accounts,
  });
  if (need.kind === "ready") return undefined;
  if (need.kind === "no-accounts") {
    notifyError(`Add an account first, then mark ${item.name} paid (Money › Accounts).`);
    return null;
  }
  const choice =
    need.kind === "only"
      ? { accountId: need.accountId, remember: true }
      : await pickPayAccount({
          billName: item.name,
          income: bill.kind === "income",
          accounts: need.accounts,
        });
  if (!choice) return null;
  if (choice.remember)
    fire({
      method: "PATCH",
      path: `/recurring/${item.id}`,
      body: { accountId: choice.accountId, updatedAt: Date.now() },
      label: `Couldn't save the account on ${item.name}`,
    });
  return choice.accountId;
}
