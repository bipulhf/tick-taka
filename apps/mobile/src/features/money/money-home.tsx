import { hasSmsPermission, isSmsReaderAvailable } from "@modules/sms-reader";
import type { AccountType } from "@tick-taka/shared/schemas/money";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { ShortcutRow } from "@/components/ui/shortcut-row";
import { Text } from "@/components/ui/text";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

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
  const { data: categories = [] } = useCategories();
  const recent = useTransactions({ limit: "6" });
  const sms = useSmsPendingCount();
  const list = accounts.data ?? [];
  const lookup = useLookup(list, categories);
  const currency = settings?.defaultCurrency ?? "BDT";
  const total = list
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  const items = recent.data?.pages.flatMap((p) => p.items) ?? [];
  const smsOff = isSmsReaderAvailable && !hasSmsPermission();

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
        <Amount minor={total} currency={currency} variant="hero" />
      </View>
      {list.length === 0 ? (
        <EmptyState
          message="Add your accounts: cash, bKash, bank, cards."
          actionLabel="Add an account"
          onAction={() => router.push("/account/new")}
        />
      ) : (
        <Group inset={60}>
          {list.map((account) => (
            <ListRow
              key={account.id}
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
          ))}
        </Group>
      )}
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
      {smsOff ? (
        <Group>
          <ListRow
            icon="message-lock-outline"
            iconColor="mango"
            title="Log bank SMS automatically"
            subtitle="Allow SMS access, nothing saves without you"
            chevron
            onPress={() => router.push("/settings/sms")}
          />
        </Group>
      ) : null}
      <Section title="Recent" action="All" onAction={() => router.push("/money/transactions")}>
        {items.length === 0 ? (
          <Text tone="muted">No transactions yet. Try “lunch 250” in quick-add.</Text>
        ) : (
          <Group inset={60}>
            {items.map((tx) => (
              <View key={tx.id} className="px-4">
                <TransactionRow tx={tx} lookup={lookup} />
              </View>
            ))}
          </Group>
        )}
      </Section>
      <Section title="More">
        <Group inset={60}>
          <ListRow
            icon="message-text-outline"
            iconColor="mint"
            title="SMS"
            subtitle={sms ? `${sms} waiting for review` : "Bank and wallet messages"}
            chevron
            onPress={() => router.push("/money/sms")}
          />
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
