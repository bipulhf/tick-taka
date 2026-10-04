import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
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
      {(accounts.data ?? []).map((account) => (
        <Card
          key={account.id}
          onPress={() => router.push(`/account/${account.id}`)}
          className="flex-row items-center gap-3"
        >
          <Text className="text-3xl">{account.icon ?? TYPE_EMOJI[account.type]}</Text>
          <View className="flex-1">
            <Text variant="strong">{account.name}</Text>
            <Text variant="caption" tone="muted">
              {account.currency}
            </Text>
          </View>
          <Amount
            minor={account.balanceMinor}
            currency={account.currency}
            variant="heading"
            tone={account.balanceMinor < 0 ? "coral" : "ink"}
          />
        </Card>
      ))}
      <Text variant="caption" tone="muted">
        Tap an account to check its balance against the real one.
      </Text>
    </Screen>
  );
}
