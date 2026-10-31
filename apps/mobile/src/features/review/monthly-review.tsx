import { addMonths } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatAmount, formatMonth, plural } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { usePrivacy } from "@/lib/privacy";
import { useThisMonth } from "@/lib/use-today";
import { useMonthlyReview } from "./queries";

/** Budgets vs actual and Someday, then a way into Budgets to plan next month. */
export function MonthlyReview() {
  const router = useRouter();
  const send = useOutbox();
  const hidden = usePrivacy();
  const month = useThisMonth();
  const review = useMonthlyReview(month);
  const next = addMonths(month, 1);
  const data = review.data;
  const money = (minor: number | null) =>
    minor === null ? "—" : hidden ? "•••" : formatAmount(minor, { signed: false });
  if (!data)
    return (
      <Screen title="Monthly review" tabBarPadding={false}>
        {review.isError ? (
          <ErrorState onRetry={() => void review.refetch()} />
        ) : (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard hero lines={1} />
            <SkeletonCard lines={3} />
          </>
        )}
      </Screen>
    );
  const lines = data.budgets.lines.filter((l) => l.hasBudget);
  return (
    <Screen title="Monthly review" subtitle={formatMonth(month)} tabBarPadding={false}>
      <Section title="Budgets vs actual">
        {lines.length === 0 ? (
          <EmptyState
            title="No budgets this month"
            message="Set a few limits and this shows how the month went."
            actionLabel="Set budgets"
            onAction={() => router.push(`/budget-edit?month=${month}`)}
          />
        ) : (
          <Card className="gap-2">
            {lines.map((line) => (
              <View key={line.categoryId} className="flex-row justify-between">
                <Text>
                  {line.emoji} {line.name}
                </Text>
                <Text tone={line.availableMinor < 0 ? "coral" : "muted"} numeric>
                  {money(line.spentMinor)} / {money(line.limitMinor)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </Section>
      <Section title="Someday">
        {data.someday.length === 0 ? (
          <EmptyState
            title="Nothing parked"
            message="Ideas you save for later will wait here."
            mood="relaxed"
          />
        ) : (
          <Card className="gap-2">
            {data.someday.map((task) => (
              <View key={task.id} className="flex-row items-center justify-between gap-2">
                <Text className="flex-1">{task.title}</Text>
                <Button
                  label="Inbox"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    send({ method: "PATCH", path: `/tasks/${task.id}`, body: { status: "inbox" } })
                  }
                />
              </View>
            ))}
          </Card>
        )}
      </Section>
      {data.subscriptions.length ? (
        <Button
          label={`${plural(data.subscriptions.length, "repeating charge")} spotted`}
          variant="secondary"
          icon="repeat-variant"
          onPress={() => router.push("/money/bills")}
        />
      ) : null}
      <Section title={`Budgets for ${formatMonth(next)}`}>
        <Card className="gap-2">
          <Text tone="muted">
            Plan them in Budgets, started from the average of the last three months.
          </Text>
          <Button
            label={`Plan ${formatMonth(next)}`}
            icon="calendar-plus"
            onPress={() => router.push(`/budget-edit?month=${next}&plan=1`)}
          />
        </Card>
      </Section>
    </Screen>
  );
}
