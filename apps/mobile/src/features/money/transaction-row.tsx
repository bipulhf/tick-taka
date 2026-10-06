import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Icon } from "@/components/ui/icon";
import { editDelete, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatWhen } from "@/lib/format";
import { useRemove } from "@/lib/use-remove";
import type { Transaction } from "./queries";
import { transactionAmount } from "./transaction-amount";

export interface Lookup {
  account: (id: string | null) => { name: string; currency: string } | undefined;
  category: (id: string | null) => { name: string; emoji: string } | undefined;
}

/** Where the row sits, which sets the background the swipe slides over. */
const PLACEMENT = {
  screen: "bg-background",
  card: "bg-card",
  group: "bg-card px-4",
} as const;

/**
 * One transaction line: "−৳120" in coral for money out, "+৳45,000" in mint for money in,
 * transfers neutral with a transfer icon. Tap to edit; swipe left for edit and delete.
 */
export function TransactionRow({
  tx,
  lookup,
  perspectiveAccountId,
  placement = "screen",
}: {
  tx: Transaction;
  lookup: Lookup;
  perspectiveAccountId?: string;
  /** "group" is a full-width row of a Group, which provides the rounding and inset. */
  placement?: keyof typeof PLACEMENT;
}) {
  const router = useRouter();
  const remove = useRemove();
  const category = lookup.category(tx.categoryId);
  const account = lookup.account(tx.accountId);
  const title =
    tx.type === "transfer"
      ? `${account?.name ?? "?"} → ${lookup.account(tx.toAccountId)?.name ?? "?"}`
      : tx.type === "adjustment"
        ? "Balance check"
        : tx.note || category?.name || (tx.type === "income" ? "Income" : "Expense");
  const amount = transactionAmount(tx, perspectiveAccountId);
  const edit = () => router.push(`/transaction/${tx.id}`);
  return (
    <SwipeRow
      rounded={placement !== "group"}
      actions={editDelete(edit, () => remove(`/transactions/${tx.id}`, `“${title}”`))}
    >
      <SwipeRowPressable
        onPress={edit}
        className={`min-h-14 flex-row items-center gap-3 py-2 active:opacity-70 ${PLACEMENT[placement]}`}
        accessibilityHint="Opens the transaction. Delete is in the actions menu"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
          <Text className="text-lg">
            {tx.type === "transfer"
              ? "🔁"
              : tx.type === "adjustment"
                ? "⚖️"
                : (category?.emoji ?? "💸")}
          </Text>
        </View>
        <View className="flex-1">
          <Text variant="strong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[
              category && tx.note ? category.name : null,
              tx.type !== "transfer" ? account?.name : null,
              formatWhen(tx.occurredAt, true),
            ]
              .filter(Boolean)
              .join(" · ")}
            {tx.feeMinor > 0 ? " · fee" : ""}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          {amount.transfer ? <Icon name="swap-horizontal" size={18} color="muted" /> : null}
          <Amount
            minor={amount.minor}
            currency={account?.currency}
            signed={amount.signed}
            tone={amount.tone}
            variant="strong"
            animate={false}
          />
        </View>
      </SwipeRowPressable>
    </SwipeRow>
  );
}

export function useLookup(
  accounts: { id: string; name: string; currency: string }[],
  categories: { id: string; name: string; emoji: string }[],
): Lookup {
  return {
    account: (id) => accounts.find((a) => a.id === id),
    category: (id) => categories.find((c) => c.id === id),
  };
}
