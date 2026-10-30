import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Row, RowMark } from "@/components/ui/group";
import { formatClock, formatWhen } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useCategories } from "@/lib/queries";
import { useUserTime } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { RowMenu } from "./money-ui";
import type { Transaction } from "./queries";
import { useReceiptUrl } from "./receipts";
import { transactionAmount } from "./transaction-amount";

export interface Lookup {
  account: (id: string | null) => { name: string; currency: string } | undefined;
  category: (id: string | null) => { name: string; emoji: string } | undefined;
}

export function useLookup(): Lookup {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  return {
    account: (id) => accounts.find((a) => a.id === id),
    category: (id) => categories.find((c) => c.id === id),
  };
}

/** What a transaction is called in a list: the note, else its category, else its kind. */
export function transactionTitle(tx: Transaction, lookup: Lookup): string {
  if (tx.type === "transfer")
    return `${lookup.account(tx.accountId)?.name ?? "?"} → ${lookup.account(tx.toAccountId)?.name ?? "?"}`;
  if (tx.type === "adjustment") return "Balance check";
  return (
    tx.note || lookup.category(tx.categoryId)?.name || (tx.type === "income" ? "Income" : "Expense")
  );
}

function ReceiptThumb({ path }: { path: string }) {
  const url = useReceiptUrl(path);
  return url.data ? (
    <img
      src={url.data}
      alt="Receipt"
      className="size-8 rounded-lg border border-line object-cover"
    />
  ) : (
    <span aria-hidden className="size-8 rounded-lg bg-line/60" />
  );
}

/**
 * One transaction line: "−৳120" in coral for money out, "+৳45,000" in mint for money
 * in, transfers neutral with a transfer icon. Click to edit; the menu and Delete key
 * remove it with Undo.
 */
export function TransactionRow({
  tx,
  lookup,
  perspectiveAccountId,
  timeOnly,
}: {
  tx: Transaction;
  lookup: Lookup;
  /** Seen from one account, a transfer carries that account's sign. */
  perspectiveAccountId?: string;
  /** The list already says the day: the subtitle gives just the time. */
  timeOnly?: boolean;
}) {
  const { timeZone } = useUserTime();
  const open = useOpenPanel();
  const category = lookup.category(tx.categoryId);
  const account = lookup.account(tx.accountId);
  const title = transactionTitle(tx, lookup);
  const amount = transactionAmount(tx, perspectiveAccountId);
  const edit = () => open(`transaction:${tx.id}`);
  const drop = () => void remove(`/transactions/${tx.id}`, `“${title}”`).catch(() => {});
  const when = timeOnly
    ? formatClock(tx.occurredAt, timeZone)
    : formatWhen(tx.occurredAt, true, Date.now(), timeZone);
  return (
    <Row
      dataKey={`transaction:${tx.id}`}
      keyActions={{ remove: drop }}
      onClick={edit}
      leading={
        <RowMark
          emoji={
            tx.type === "transfer"
              ? "🔁"
              : tx.type === "adjustment"
                ? "⚖️"
                : (category?.emoji ?? "💸")
          }
        />
      }
      title={title}
      subtitle={
        [
          category && tx.note ? category.name : null,
          tx.type !== "transfer" ? account?.name : null,
          when,
        ]
          .filter(Boolean)
          .join(" · ") + (tx.feeMinor > 0 ? " · fee" : "")
      }
      trailing={
        <>
          {tx.receiptPath ? <ReceiptThumb path={tx.receiptPath} /> : null}
          {amount.transfer ? (
            <>
              <ArrowLeftRight aria-hidden className="size-4 text-muted" />
              <span className="sr-only">Transfer</span>
            </>
          ) : null}
          <Amount
            minor={amount.minor}
            currency={account?.currency}
            signed={amount.signed}
            tone={amount.tone === "mint" ? "in" : amount.tone === "coral" ? "out" : undefined}
            animate={false}
            className="font-bold"
          />
          <RowMenu
            label={`More for ${title}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: edit },
              { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
            ]}
          />
        </>
      }
    />
  );
}
