import { addMonths, isLocalMonth } from "@tick-taka/shared/dates";
import { useState } from "react";
import { View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChartAxis } from "@/components/ui/chart-axis";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatMonth, plural } from "@/lib/format";
import { useThisMonth } from "@/lib/use-today";
import { useColors } from "@/theme/colors";
import { useAiUsage } from "./queries";

const FEATURES: Record<string, string> = {
  assistant: "Chat with Tiki and voice",
  parse: "Smart quick-add",
  receipt: "Receipt scan",
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  ask: "Ask my data",
  budgetSuggestions: "Budget suggestions",
};

/** Micro-dollars as dollars; tiny amounts keep enough digits to show they're not zero. */
function dollars(micros: number): string {
  if (micros === 0) return "$0.00";
  if (micros < 10_000) return "<$0.01";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

const thousands = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());

function Row({ title, detail, value }: { title: string; detail: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <View className="flex-1">
        <Text>{title}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <Text variant="strong" numeric>
        {value}
      </Text>
    </View>
  );
}

/** What AI cost this month: by day, by feature and, for the owner, by user. */
export function AiUsageScreen() {
  const colors = useColors();
  const axis = useChartAxis();
  const current = useThisMonth();
  const [monthsBack, setMonthsBack] = useState(0);
  const month = addMonths(current, -monthsBack);
  const usage = useAiUsage(isLocalMonth(month) ? month : undefined);
  const data = usage.data;
  const days = data
    ? Array.from(
        { length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() },
        (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const cents = (data.byDay.find((d) => d.date === date)?.costMicros ?? 0) / 10_000;
          return {
            value: Math.round(cents * 100) / 100,
            label: (i + 1) % 5 === 1 ? String(i + 1) : "",
            // Neutral: AI cost isn't a habit, so it doesn't borrow habit purple.
            frontColor: colors.muted,
          };
        },
      )
    : [];
  return (
    <Screen title="AI cost" subtitle={formatMonth(month)} tabBarPadding={false}>
      <AsyncContent
        query={usage}
        skeleton={
          <>
            <SkeletonCard hero lines={1} />
            <Skeleton className="h-56 w-full rounded-3xl" />
            <SkeletonCard lines={3} />
          </>
        }
        isEmpty={(report) => report.calls === 0 && !report.users?.some((u) => u.calls > 0)}
        empty={
          <EmptyState
            title="No AI use this month"
            message="Each AI request lands here with what it cost, so the bill never surprises you."
            mood="calm"
          />
        }
      >
        {(report) => (
          <>
            <Card className="gap-2">
              <Text variant="display" numeric>
                {dollars(report.costMicros)}
              </Text>
              <Text tone="muted">
                {report.capMicros === null
                  ? `at OpenAI's list prices · ${plural(report.calls, "request")}`
                  : `of the ${dollars(report.capMicros)} monthly limit · ${plural(report.calls, "request")}`}
              </Text>
              {report.capMicros === null ? null : (
                <ProgressBar
                  value={report.costMicros / report.capMicros}
                  tone={report.costMicros >= report.capMicros ? "coral" : "ink"}
                />
              )}
            </Card>
            <Card className="gap-2">
              <Text variant="label" tone="muted">
                Each day, in cents
              </Text>
              <BarChart
                data={days}
                barWidth={6}
                spacing={3}
                roundedTop
                noOfSections={3}
                {...axis}
                yAxisLabelWidth={40}
                xAxisLabelTextStyle={{ ...axis.xAxisLabelTextStyle, width: 24 }}
                hideRules
              />
            </Card>
            <Card className="gap-1">
              <Text variant="label" tone="muted">
                By feature
              </Text>
              {report.byFeature.map((row) => (
                <Row
                  key={row.feature}
                  title={FEATURES[row.feature] ?? row.feature}
                  detail={`${plural(row.calls, "request")} · ${thousands(row.inputTokens)} in, ${thousands(row.outputTokens)} out tokens`}
                  value={dollars(row.costMicros)}
                />
              ))}
              {report.byFeature.length === 0 ? (
                <Text tone="muted">You didn't use AI this month.</Text>
              ) : null}
            </Card>
            {report.users ? (
              <Card className="gap-1">
                <Text variant="label" tone="muted">
                  Everyone on your server ·{" "}
                  {dollars(report.users.reduce((sum, u) => sum + u.costMicros, 0))}
                </Text>
                {report.users.map((user) => (
                  <Row
                    key={user.email}
                    title={user.me ? "You" : (user.name ?? user.email)}
                    detail={`${user.me || !user.name ? "" : `${user.email} · `}${plural(user.calls, "request")}`}
                    value={dollars(user.costMicros)}
                  />
                ))}
              </Card>
            ) : null}
          </>
        )}
      </AsyncContent>
      <View className="flex-row gap-2">
        <Button
          label="Earlier"
          variant="secondary"
          size="sm"
          onPress={() => setMonthsBack(monthsBack + 1)}
          className="flex-1"
        />
        <Button
          label="Later"
          variant="secondary"
          size="sm"
          disabled={monthsBack === 0}
          onPress={() => setMonthsBack(monthsBack - 1)}
          className="flex-1"
        />
      </View>
    </Screen>
  );
}
