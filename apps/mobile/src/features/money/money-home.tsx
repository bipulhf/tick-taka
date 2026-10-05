import type { AccountType } from "@tick-taka/shared/schemas/money";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { ShortcutRow } from "@/components/ui/shortcut-row";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";
import { useAccountActions } from "./use-account-actions";

const ACCOUNT_ICON: Record<AccountType, IconName> = {
  cash: "cash",
  bank: "bank-outline",
  mobile_wallet: "cellphone",
  card: "credit-card-outline",
  savings: "piggy-bank-outline",
};

export function MoneyHome() {
  const router = useRouter();
  const { data: settings } = useSettings();
  const accounts = useAccounts();
  const accountActions = useAccountActions();
  const { data: categories = [] } = useCategories();
  const recent = useTransactions({ limit: "6" });
  const list = accounts.data ?? [];
  const lookup = useLookup(list, categories);
  const currency = settings?.defaultCurrency ?? "BDT";
  const total = list
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  const items = recent.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen
      title="Money"
      refreshing={accounts.isRefetching}
      onRefresh={() => void accounts.refetch()}
    >
      <View className="gap-1">
        <Text variant="callout" tone="muted">
          All accounts
        </Text>
        {accounts.data ? (
          <Amount minor={total} currency={currency} variant="hero" />
        ) : (
          <Skeleton className="mt-1 h-11 w-1/2 rounded-2xl" />
        )}
      </View>
      <View className="flex-row gap-3">
        <Button
          label="Expense"
          icon="minus"
          variant="secondary"
          className="flex-1"
          onPress={() => router.push("/add?kind=expense")}
        />
        <Button
          label="Income"
          icon="plus"
          variant="secondary"
          className="flex-1"
          onPress={() => router.push("/add?kind=income")}
        />
      </View>
      <ShortcutRow
        items={[
          {
            label: "Transactions",
            icon: "swap-vertical",
            color: "mint",
            onPress: () => router.push("/money/transactions"),
          },
          {
            label: "Budgets",
            icon: "chart-pie",
            color: "mint",
            onPress: () => router.push("/money/budgets"),
          },
          {
            label: "Bills",
            icon: "receipt",
            color: "coral",
            onPress: () => router.push("/money/bills"),
          },
          {
            label: "Goals",
            icon: "piggy-bank-outline",
            color: "grape",
            onPress: () => router.push("/money/goals"),
          },
        ]}
      />
      <AsyncContent
        query={accounts}
        skeleton={<SkeletonList rows={3} trailing />}
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
        {() => (
          <Group inset={60}>
            {list.map((account) => (
              <SwipeRow
                key={account.id}
                rounded={false}
                actions={accountActions.rowActions(account, () =>
                  router.push(`/account/${account.id}`),
                )}
              >
                <View className="bg-card">
                  <ListRow
                    emoji={account.icon ?? undefined}
                    icon={ACCOUNT_ICON[account.type]}
                    iconColor="mint"
                    title={account.name}
                    onPress={() => router.push(`/money/transactions?accountId=${account.id}`)}
                    right={
                      <Amount
                        minor={account.balanceMinor}
                        currency={account.currency}
                        variant="strong"
                        animate={false}
                        tone={account.balanceMinor < 0 ? "coral" : "ink"}
                      />
                    }
                  />
                </View>
              </SwipeRow>
            ))}
          </Group>
        )}
      </AsyncContent>
      <Section title="Recent" action="All" onAction={() => router.push("/money/transactions")}>
        <AsyncContent
          query={recent}
          skeleton={<SkeletonList rows={4} trailing />}
          isEmpty={() => items.length === 0}
          empty={
            <EmptyState
              title="No transactions yet"
              message="Log one in seconds: try “lunch 250” in quick-add, or tell Tiki."
              actionLabel="Add one"
              onAction={() => router.push("/add?kind=expense")}
            />
          }
        >
          {() => (
            <Group inset={60}>
              {items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} lookup={lookup} placement="group" />
              ))}
            </Group>
          )}
        </AsyncContent>
      </Section>
      <Section title="More">
        <Group inset={60}>
          <ListRow
            icon="handshake-outline"
            iconColor="grape"
            title="Debts"
            subtitle="Who owes whom"
            chevron
            onPress={() => router.push("/money/debts")}
          />
          <ListRow
            icon="airplane"
            iconColor="sky"
            title="Events"
            subtitle="Trips and occasions"
            chevron
            onPress={() => router.push("/money/events")}
          />
          <ListRow
            icon="calendar-month"
            iconColor="sky"
            title="Calendar"
            subtitle="Spending by day"
            chevron
            onPress={() => router.push("/money/calendar")}
          />
          {settings?.advancedViews.shoppingList ? (
            <ListRow
              icon="cart-outline"
              iconColor="coral"
              title="Shopping"
              chevron
              onPress={() => router.push("/money/shopping")}
            />
          ) : null}
          <ListRow
            icon="wallet-outline"
            iconColor="mint"
            title="Accounts"
            subtitle="Add, edit, reconcile"
            chevron
            onPress={() => router.push("/money/accounts")}
          />
        </Group>
      </Section>
    </Screen>
  );
}
