import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import type { TodayData } from "@/lib/queries";

/** One number for the shop counter: what's safe to spend today. */
export function SafeToSpendCard({ data }: { data: TodayData }) {
  const router = useRouter();
  const money = data.safeToSpend;
  if (!money.hasBudgets) {
    return (
      <Card onPress={() => router.push("/money/budgets")} className="gap-1">
        <Text variant="callout" tone="muted">
          Safe to spend today
        </Text>
        <Text variant="strong">Set a flexible budget to see a daily number.</Text>
      </Card>
    );
  }
  const over = money.leftTodayMinor < 0;
  return (
    <Card
      onPress={() => router.push("/money/budgets")}
      accessibilityLabel="Safe to spend today"
      className="gap-3"
    >
      <Text variant="callout" tone="muted">
        {over ? "Over today's amount by" : "Safe to spend today"}
      </Text>
      <Amount
        minor={Math.abs(money.leftTodayMinor)}
        variant="hero"
        tone={over ? "coral" : "mint"}
      />
      <ProgressBar
        value={money.dailyMinor > 0 ? money.spentTodayMinor / money.dailyMinor : over ? 1 : 0}
        tone={over ? "coral" : "mint"}
      />
      <View className="flex-row items-center justify-between">
        <Text variant="callout" tone="muted">
          <Amount minor={money.spentTodayMinor} variant="callout" tone="ink" animate={false} />{" "}
          spent of <Amount minor={money.dailyMinor} variant="callout" tone="ink" animate={false} />
        </Text>
        <Text variant="callout" tone="muted">
          {money.daysLeft} days left
        </Text>
      </View>
      {data.paceAlert ? (
        <Text variant="callout" tone="coral">
          {data.paceAlert.emoji} {data.paceAlert.name} is running ahead of the month
        </Text>
      ) : null}
    </Card>
  );
}
