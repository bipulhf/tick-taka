import { newId } from "@tick-taka/shared/ids";
import { notify } from "@/lib/toast";
import { fire, type WriteRequest, write } from "@/lib/write";

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
 * panel's choices (account, amount, rate) when the pay came from there.
 */
export async function payRecurring(
  item: { id: string; name: string; dueAt: number },
  options: { skip?: boolean; extra?: Record<string, unknown> } = {},
): Promise<void> {
  const body: PayBody = {
    ...options.extra,
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
  notify(options.skip ? `Skipped ${item.name}` : `${item.name} logged`, {
    label: "Undo",
    onPress: () => {
      fire(unpayRequest(item, body));
      notify(`Took back ${item.name}`);
    },
  });
}
