import type { OutboxRequest } from "@/lib/outbox-policy";

/** What POST /recurring/:id/pay replies with, as far as Undo needs it. */
export interface PayReply {
  transaction: { id: string } | null;
  /** The due date the bill moved from; null when the pay changed nothing (a replay). */
  previousDueAt?: number | null;
}

/**
 * The writes that take back a "Paid" / "Received" / "Skip": delete the transaction it
 * logged, then move the due date back. Sent in this order through the outbox.
 */
export function undoPayRequests(
  recurringId: string,
  name: string,
  reply: PayReply,
): OutboxRequest[] {
  const label = `Couldn't undo ${name}`;
  const requests: OutboxRequest[] = [];
  if (reply.transaction)
    requests.push({ method: "DELETE", path: `/transactions/${reply.transaction.id}`, label });
  if (reply.previousDueAt != null)
    requests.push({
      method: "PATCH",
      path: `/recurring/${recurringId}`,
      body: { nextDueAt: reply.previousDueAt },
      label,
    });
  return requests;
}

type Send = ((request: OutboxRequest) => void) & {
  async: (request: OutboxRequest) => Promise<unknown>;
};

/**
 * Pays (or skips) a bill or income and returns the Undo for the snackbar. Undo waits
 * for the pay to land, so offline it takes effect once both reach the server.
 */
export function payRecurring(
  send: Send,
  item: { id: string; name: string },
  body: Record<string, unknown>,
): () => void {
  const paid = send
    .async({
      method: "POST",
      path: `/recurring/${item.id}/pay`,
      body,
      label: `Couldn't log ${item.name}`,
    })
    .catch(() => null) as Promise<PayReply | null>;
  return () => {
    void paid.then((reply) => {
      if (!reply) return;
      for (const request of undoPayRequests(item.id, item.name, reply)) send(request);
    });
  };
}
