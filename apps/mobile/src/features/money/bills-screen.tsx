import { describeRRule } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useRecurring } from "@/features/plan/queries";
import { formatLocalDate } from "@/lib/format";

const STATUS = {
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  upcoming: "",
} as const;

/** Bills and subscriptions, plus salaries and other expected income. */
export function BillsScreen() {
  const router = useRouter();
  const recurring = useRecurring();
  const list = recurring.data ?? [];
  const groups = [
    { title: "Bills and subscriptions", items: list.filter((r) => r.kind === "bill") },
    { title: "Expected income", items: list.filter((r) => r.kind === "income") },
  ];
  return (
    <Screen
      title="Bills & income"
      tabBarPadding={false}
      right={
        <Button
          label="New"
          size="sm"
          icon="plus"
          onPress={() => router.push("/money/recurring/new")}
        />
      }
    >
      {list.length === 0 ? (
        <EmptyState
          message="Add rent, internet or your salary so nothing sneaks up."
          actionLabel="Add a bill"
          onAction={() => router.push("/money/recurring/new")}
        />
      ) : null}
      {groups.map((group) =>
        group.items.length ? (
          <Section key={group.title} title={group.title}>
            {group.items.map((item) => (
              <Card
                key={item.id}
                onPress={() => router.push(`/money/recurring/${item.id}`)}
                className="flex-row items-center gap-3"
              >
                <View className="flex-1">
                  <Text variant="strong">{item.name}</Text>
                  <Text variant="caption" tone={item.status === "overdue" ? "coral" : "muted"}>
                    {[STATUS[item.status], formatLocalDate(item.dueDate), describeRRule(item.rrule)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Amount
                  minor={item.amountMinor}
                  currency={item.currency}
                  variant="strong"
                  tone={item.kind === "income" ? "mint" : "ink"}
                />
              </Card>
            ))}
          </Section>
        ) : null,
      )}
    </Screen>
  );
}
