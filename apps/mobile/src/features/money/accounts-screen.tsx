import { useRouter } from "expo-router";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAccounts } from "@/lib/queries";

const TYPE_EMOJI = {
  cash: "💵",
  bank: "🏦",
  mobile_wallet: "📱",
  card: "💳",
  savings: "🫙",
} as const;

/** Balances that match the real world, wallet included. */
export function AccountsScreen() {
  const router = useRouter();
  const accounts = useAccounts();
  return (
    <Screen
      title="Accounts"
      tabBarPadding={false}
      right={
        <Button label="New" size="sm" icon="plus" onPress={() => router.push("/account/new")} />
      }
    >
      <AsyncContent
        query={accounts}
        skeleton={<SkeletonList rows={4} trailing />}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            title="No accounts yet"
            message="Add where your money lives: cash, bKash, bank, cards."
            actionLabel="Add an account"
            onAction={() => router.push("/account/new")}
          />
        }
      >
        {(data) => (
          <Group inset={60}>
            {data.map((account) => (
              <ListRow
                key={account.id}
                emoji={account.icon ?? TYPE_EMOJI[account.type]}
                title={account.name}
                subtitle={account.currency}
                onPress={() => router.push(`/account/${account.id}`)}
                right={
                  <Amount
                    minor={account.balanceMinor}
                    currency={account.currency}
                    variant="strong"
                    tone={account.balanceMinor < 0 ? "coral" : "ink"}
                  />
                }
              />
            ))}
          </Group>
        )}
      </AsyncContent>
      <Text variant="caption" tone="muted">
        Tap an account to check its balance against the real one.
      </Text>
    </Screen>
  );
}
