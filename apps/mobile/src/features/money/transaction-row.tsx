import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatWhen } from "@/lib/format";
import { useRemove } from "@/lib/use-remove";
import type { Transaction } from "./queries";

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
 * One transaction line: coral for money out, mint for money in. Tap to edit;
 * swipe left for edit and delete.
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
  const incoming =
    tx.type === "income" ||
    (tx.type === "transfer" && perspectiveAccountId === tx.toAccountId) ||
    (tx.type === "adjustment" && tx.amountMinor > 0);
  const title =
    tx.type === "transfer"
      ? `${account?.name ?? "?"} → ${lookup.account(tx.toAccountId)?.name ?? "?"}`
      : tx.type === "adjustment"
        ? "Balance check"
        : tx.note || category?.name || (tx.type === "income" ? "Income" : "Expense");
  const amount =
    tx.type === "adjustment"
      ? Math.abs(tx.amountMinor)
      : tx.type === "transfer" && incoming
        ? (tx.toAmountMinor ?? tx.amountMinor)
        : tx.amountMinor;
  const edit = () => router.push(`/transaction/${tx.id}`);
  return (
    <SwipeRow
      rounded={placement !== "group"}
      actions={editDelete(edit, () => remove(`/transactions/${tx.id}`, `“${title}”`))}
    >
      <Pressable
        onPress={edit}
        className={`min-h-14 flex-row items-center gap-3 py-2 active:opacity-70 ${PLACEMENT[placement]}`}
        accessibilityRole="button"
        accessibilityHint="Swipe left for edit and delete"
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
        <Amount
          minor={amount}
          currency={account?.currency}
          signed={incoming}
          tone={incoming ? "mint" : tx.type === "transfer" ? "ink" : "coral"}
          variant="strong"
          animate={false}
        />
      </Pressable>
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
