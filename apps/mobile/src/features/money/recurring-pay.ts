import type { OutboxRequest } from "@/lib/outbox-policy";

/** What a "Paid" / "Received" / "Skip" sends, as far as its Undo needs it. */
export interface PayBody extends Record<string, unknown> {
  /** Made on the phone, so the Undo can name the transaction before the reply. */
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
export function unpayRequest(item: { id: string; name: string }, body: PayBody): OutboxRequest {
  return {
    method: "POST",
    path: `/recurring/${item.id}/unpay`,
    body: { transactionId: body.transactionId, dueAt: body.dueAt, skip: body.skip ?? false },
    label: `Couldn't undo ${item.name}`,
  };
}

/** Queues a write (saved, sent in order) and can take back one not yet sent. */
type Send = ((request: OutboxRequest) => void) & {
  cancel: (match: (request: OutboxRequest) => boolean) => boolean;
};

/**
 * Pays (or skips) a bill or income and returns the Undo for the snackbar. Both halves go
 * through the saved queue, so an Undo made offline holds across a restart: if the pay
 * hasn't gone out it is taken off the queue, otherwise its reversal is queued behind it.
 */
export function payRecurring(
  send: Send,
  item: { id: string; name: string },
  body: PayBody,
): () => void {
  const pay: OutboxRequest = {
    method: "POST",
    path: `/recurring/${item.id}/pay`,
    body,
    label: `Couldn't log ${item.name}`,
  };
  send(pay);
  return () => {
    if (send.cancel((request) => request === pay)) return;
    send(unpayRequest(item, body));
  };
}
