import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import type { TodayData } from "@/lib/queries";

export function SafeToSpendCard({ data }: { data: TodayData }) {
  const router = useRouter();
  const money = data.safeToSpend;
  if (!money.hasBudgets) {
    return (
      <Card onPress={() => router.push("/money/budgets")}>
        <Text variant="label" tone="muted">
          Safe to spend today
        </Text>
        <Text className="mt-1">
          Set a flexible budget for food, rides and fun to see a daily number here.
        </Text>
      </Card>
    );
  }
  const over = money.leftTodayMinor < 0;
  return (
    <Card onPress={() => router.push("/money/budgets")} accessibilityLabel="Safe to spend today">
      <Text variant="label" tone="muted">
        Safe to spend today
      </Text>
      <Amount
        minor={Math.max(0, money.leftTodayMinor)}
        variant="display"
        tone={over ? "coral" : "mint"}
        className="mt-1"
      />
      <ProgressBar
        value={money.dailyMinor > 0 ? money.spentTodayMinor / money.dailyMinor : over ? 1 : 0}
        tone={over ? "coral" : "mint"}
        className="mt-3"
      />
      <View className="mt-2 flex-row justify-between">
        <Text variant="caption" tone="muted">
          Spent today{" "}
          <Amount minor={money.spentTodayMinor} variant="caption" tone="ink" animate={false} />
        </Text>
        <Text variant="caption" tone="muted">
          of <Amount minor={money.dailyMinor} variant="caption" tone="ink" animate={false} /> ·{" "}
          {money.daysLeft} days left
        </Text>
      </View>
      {data.paceAlert ? (
        <Text variant="caption" tone="coral" className="mt-2">
          Heads-up: {data.paceAlert.emoji} {data.paceAlert.name} is running ahead of the month.
        </Text>
      ) : null}
    </Card>
  );
}
