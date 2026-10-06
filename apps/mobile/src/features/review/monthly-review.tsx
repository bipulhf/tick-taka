import { useMutation } from "@tanstack/react-query";
import { addMonths, toLocalMonth } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatAmount, formatMinutes, formatMonth } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { usePrivacy } from "@/lib/privacy";
import { useAiStatus, useAreas, useCategories } from "@/lib/queries";
import { useMonthlyReview } from "./queries";

/** Budgets vs actual, net worth change, hourly rates, Someday, then next month's budgets. */
export function MonthlyReview() {
  const router = useRouter();
  const send = useOutbox();
  const hidden = usePrivacy();
  const month = toLocalMonth(Date.now());
  const review = useMonthlyReview(month);
  const ai = useAiStatus();
  const { data: areas = [] } = useAreas();
  const { data: categories = [] } = useCategories();
  const next = addMonths(month, 1);
  const aiBudgets = useMutation({
    mutationFn: () => unwrap(api.ai["budget-suggestions"].$post({ json: { month: next } })),
    onSuccess: (result) => {
      const suggested = Object.fromEntries(result.budgets.map((b) => [b.categoryId, b.limitMinor]));
      router.push(
        `/budget-edit?month=${next}&suggested=${encodeURIComponent(JSON.stringify(suggested))}`,
      );
    },
    onError: (e) => notify(friendlyError(e)),
  });
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
      <Section title="Net worth">
        <Card>
          <Text
            variant="title"
            tone={(data.netWorth.changeMinor ?? 0) < 0 ? "coral" : "mint"}
            numeric
          >
            {data.netWorth.changeMinor === null
              ? "—"
              : `${data.netWorth.changeMinor >= 0 ? "+" : "−"}${money(Math.abs(data.netWorth.changeMinor))}`}
          </Text>
          <Text tone="muted">Now {money(data.netWorth.endMinor)}</Text>
        </Card>
      </Section>
      <Section title="Hourly rate by area">
        {data.hourlyRates.length === 0 ? (
          <EmptyState
            title="No hourly rates yet"
            message="Tag income and time with areas to see which work pays best."
          />
        ) : (
          <Card className="gap-2">
            {data.hourlyRates.map((rate) => {
              const area = areas.find((a) => a.id === rate.areaId);
              return (
                <View key={rate.areaId} className="flex-row justify-between">
                  <Text>{area ? `${area.emoji} ${area.name}` : "Area"}</Text>
                  <Text numeric>
                    {rate.rateMinor === null || rate.incomeMinor === 0
                      ? `${formatMinutes(rate.minutes)}, no income`
                      : `${money(rate.rateMinor)}/h`}
                  </Text>
                </View>
              );
            })}
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
          label={`${data.subscriptions.length} repeating charge${data.subscriptions.length === 1 ? "" : "s"} spotted`}
          variant="secondary"
          icon="repeat-variant"
          onPress={() => router.push("/review/subscriptions")}
        />
      ) : null}
      <Section title={`Budgets for ${formatMonth(next)}`}>
        <Card className="gap-2">
          {data.suggestedBudgets.slice(0, 6).map((line) => {
            const category = categories.find((c) => c.id === line.categoryId);
            return (
              <View key={line.categoryId} className="flex-row justify-between">
                <Text>{category ? `${category.emoji} ${category.name}` : "Category"}</Text>
                <Text numeric>{money(line.limitMinor)}</Text>
              </View>
            );
          })}
          <Text variant="caption" tone="muted">
            From the average of the last three months.
          </Text>
          <Button
            label="Use these"
            onPress={() =>
              router.push(
                `/budget-edit?month=${next}&suggested=${encodeURIComponent(JSON.stringify(Object.fromEntries(data.suggestedBudgets.map((b) => [b.categoryId, b.limitMinor]))))}`,
              )
            }
          />
          {ai.data?.configured && ai.data.features.budgetSuggestions ? (
            <Button
              label="Ask AI for suggestions"
              variant="secondary"
              icon="auto-fix"
              loading={aiBudgets.isPending}
              onPress={() => aiBudgets.mutate()}
            />
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
