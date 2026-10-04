import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

const LINKS: { href: string; label: string; icon: IconName; flag?: "shoppingList" }[] = [
  { href: "/money/transactions", label: "Transactions", icon: "swap-vertical" },
  { href: "/money/budgets", label: "Budgets", icon: "chart-pie" },
  { href: "/money/bills", label: "Bills", icon: "receipt" },
  { href: "/money/goals", label: "Goals", icon: "piggy-bank-outline" },
  { href: "/money/debts", label: "Debts", icon: "handshake-outline" },
  { href: "/money/events", label: "Events", icon: "airplane" },
  { href: "/money/calendar", label: "Calendar", icon: "calendar-month" },
  { href: "/money/shopping", label: "Shopping", icon: "cart-outline", flag: "shoppingList" },
  { href: "/money/sms", label: "SMS", icon: "message-text-outline" },
];

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
  const links = LINKS.filter((link) => !link.flag || settings?.advancedViews[link.flag]);
  const items = recent.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen
      title="Money"
      subtitle="Where is it, and where is it going?"
      refreshing={accounts.isRefetching}
      onRefresh={() => void accounts.refetch()}
    >
      <Card onPress={() => router.push("/money/accounts")}>
        <Text variant="label" tone="muted">
          All accounts
        </Text>
        <Amount minor={total} currency={currency} variant="display" />
        <View className="mt-2 gap-1">
          {list.map((account) => (
            <View key={account.id} className="flex-row justify-between">
              <Text tone="muted">{account.name}</Text>
              <Amount
                minor={account.balanceMinor}
                currency={account.currency}
                variant="body"
                animate={false}
                tone={account.balanceMinor < 0 ? "coral" : "ink"}
              />
            </View>
          ))}
        </View>
      </Card>
      {list.length === 0 ? (
        <EmptyState
          message="Add your accounts: cash, bKash, bank, cards."
          actionLabel="Add an account"
          onAction={() => router.push("/account/new")}
        />
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {links.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href as never)}
            className="w-[31%] items-center gap-1 rounded-2xl bg-card py-3 active:opacity-70"
            accessibilityRole="button"
          >
            <View>
              <Icon name={link.icon} color="mint" />
              {link.href === "/money/sms" && sms > 0 ? (
                <View className="absolute -right-3 -top-1 rounded-full bg-coral px-1.5">
                  <Text className="text-[10px] font-nunito-bold text-white">{sms}</Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" className="font-nunito-bold">
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Section title="Recent" action="All" onAction={() => router.push("/money/transactions")}>
        <Card className="py-1">
          {items.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} lookup={lookup} />
          ))}
          {items.length === 0 ? (
            <Text tone="muted" className="py-3">
              No transactions yet. Try “lunch 250” in quick-add.
            </Text>
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
