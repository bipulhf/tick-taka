import { newId } from "@tick-taka/shared/ids";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { type SmsCard, smsCardsStore, updateCard } from "./sms-store";

export interface Mismatch {
  accountId: string;
  appMinor: number;
  smsMinor: number;
}

/** Add, ignore and undo for SMS cards. Adding is the only path that creates a transaction. */
export function useSmsActions(
  balances: Map<string, number>,
  onMismatch: (mismatch: Mismatch) => void,
) {
  const send = useOutbox();

  const markAdded = (fingerprint: string, transactionId: string) => {
    updateCard(fingerprint, { status: "added", transactionId });
    send({
      method: "PATCH",
      path: `/sms-imports/${encodeURIComponent(fingerprint)}`,
      body: { status: "added", transactionId },
    });
  };

  const add = (card: SmsCard, initialCategoryId: string | null = card.categoryId) => {
    const id = newId();
    const { parsed } = card;
    const body =
      card.kind === "transfer"
        ? {
            id,
            type: "transfer",
            accountId: card.accountId,
            toAccountId: card.toAccountId,
            amountMinor: parsed.amountMinor,
            feeMinor: parsed.feeMinor,
            note: card.note,
            occurredAt: card.receivedAt,
          }
        : {
            id,
            type: card.kind,
            accountId: card.accountId,
            amountMinor: parsed.amountMinor,
            feeMinor: parsed.feeMinor,
            categoryId: card.categoryId,
            note: card.note,
            occurredAt: card.receivedAt,
          };
    if (card.kind === "transfer" && !card.toAccountId) {
      notify("Pick a Cash account in Settings for cash-outs");
      return;
    }
    send({ method: "POST", path: "/transactions", body, label: "Couldn't add from SMS" });
    markAdded(card.fingerprint, id);
    // Learn from edits: a changed category is remembered for this merchant.
    if (card.categoryId && card.categoryId !== initialCategoryId && card.note) {
      send({
        method: "POST",
        path: "/category-rules",
        body: { matchText: card.note, categoryId: card.categoryId },
      });
    }
    // Balance after the transaction, compared with what the app expects.
    if (parsed.balanceAfterMinor !== null) {
      const effect =
        card.kind === "income"
          ? parsed.amountMinor - parsed.feeMinor
          : -(parsed.amountMinor + parsed.feeMinor);
      const expected = (balances.get(card.accountId) ?? 0) + effect;
      if (expected !== parsed.balanceAfterMinor)
        onMismatch({
          accountId: card.accountId,
          appMinor: expected,
          smsMinor: parsed.balanceAfterMinor,
        });
    }
  };

  const restore = (card: SmsCard) => {
    updateCard(card.fingerprint, { status: "pending", ignoredAt: null });
    send({
      method: "PATCH",
      path: `/sms-imports/${encodeURIComponent(card.fingerprint)}`,
      body: { status: "pending" },
    });
  };

  return {
    add,
    markAdded,
    restore,
    ignore(card: SmsCard) {
      updateCard(card.fingerprint, { status: "ignored", ignoredAt: Date.now() });
      send({
        method: "PATCH",
        path: `/sms-imports/${encodeURIComponent(card.fingerprint)}`,
        body: { status: "ignored" },
      });
      notify("Ignored", { label: "Undo", onPress: () => restore(card) });
    },
    fixBalance(mismatch: Mismatch) {
      send({
        method: "POST",
        path: `/accounts/${mismatch.accountId}/balance-check`,
        body: { actualMinor: mismatch.smsMinor, id: newId() },
        label: "Couldn't fix the balance",
      });
      notify("Balance fixed");
    },
    pending: () => smsCardsStore.get().filter((c) => c.status === "pending"),
  };
}
