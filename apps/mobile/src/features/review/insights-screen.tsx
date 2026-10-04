import { addMonths, localMonthRange, toLocalMonth } from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";
import { useState } from "react";
import { View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { useInsights } from "@/features/money/queries";
import { formatMinutes, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useAreas, useCategories, useSettings } from "@/lib/queries";
import { useChartColors, useColors } from "@/theme/colors";
import { useMonthlySeries, useNetWorth } from "./queries";

type Range = "this" | "last" | "quarter";

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** Spending by category, income vs expense by month, net worth over time, spending by area. */
export function InsightsScreen() {
  const colors = useColors();
  const chart = useChartColors();
  const hidden = usePrivacy();
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const [range, setRange] = useState<Range>("this");
  const month = toLocalMonth(Date.now(), timeZone);
  const span =
    range === "this"
      ? localMonthRange(month, timeZone)
      : range === "last"
        ? localMonthRange(addMonths(month, -1), timeZone)
        : {
            from: localMonthRange(addMonths(month, -2), timeZone).from,
            to: localMonthRange(month, timeZone).to,
          };
  const summary = useInsights(span.from, span.to);
  const series = useMonthlySeries(6);
  const worth = useNetWorth(12);
  const data = summary.data;

  // Roll child categories into their parents for a readable ranking.
  const parentOf = (id: string | null) => {
    const category = categories.find((c) => c.id === id);
    return category?.parentId ?? id;
  };
  const byParent = new Map<string | null, number>();
  for (const row of data?.spendingByCategory ?? [])
    byParent.set(
      parentOf(row.categoryId),
      (byParent.get(parentOf(row.categoryId)) ?? 0) + row.amountMinor,
    );
  const ranked = [...byParent.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 1;

  const monthBars = (series.data ?? []).flatMap((m) => [
    {
      value: m.incomeMinor / 100,
      frontColor: chart.moneyIn,
      spacing: 2,
      label: formatMonth(m.month).slice(0, 3),
    },
    { value: m.spentMinor / 100, frontColor: chart.moneyOut },
  ]);
  const worthPoints = (worth.data?.series ?? []).map((p) => ({
    value: p.netWorthMinor / 100,
    label: formatMonth(p.month).slice(0, 3),
  }));
  const axis = {
    yAxisThickness: 0,
    xAxisColor: colors.line,
    yAxisTextStyle: { color: colors.muted, fontSize: 10 },
    xAxisLabelTextStyle: { color: colors.muted, fontSize: 10 },
    rulesColor: colors.line,
  };

  return (
    <Screen title="Reports" tabBarPadding={false}>
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: "this", label: "This month" },
          { value: "last", label: "Last month" },
          { value: "quarter", label: "3 months" },
        ]}
      />
      {data ? (
        <View className="flex-row gap-2">
          <Card className="flex-1">
            <Text variant="label" tone="muted">
              In
            </Text>
            <Amount minor={data.totals.incomeMinor} variant="heading" />
          </Card>
          <Card className="flex-1">
            <Text variant="label" tone="muted">
              Out
            </Text>
            <Amount minor={data.totals.spentMinor} variant="heading" />
          </Card>
          <Card className="flex-1">
            <Text variant="label" tone="muted">
              Net
            </Text>
            <Amount minor={data.totals.netMinor} variant="heading" signed />
          </Card>
        </View>
      ) : null}
      <Section title="Spending by category">
        <Card className="gap-3">
          {ranked.map(([id, amount]) => {
            const category = categories.find((c) => c.id === id);
            return (
              <View
                key={id ?? "none"}
                className="gap-1"
                accessible
                accessibilityLabel={`${category?.name ?? "Uncategorised"}: ${formatAmount(amount)}`}
              >
                <View className="flex-row justify-between">
                  <Text>{category ? `${category.emoji} ${category.name}` : "Uncategorised"}</Text>
                  <Amount minor={amount} variant="strong" animate={false} />
                </View>
                <View className="h-2.5 flex-row overflow-hidden rounded-full bg-line">
                  <View
                    style={{ width: `${(amount / top) * 100}%`, backgroundColor: chart.moneyOut }}
                    className="rounded-full"
                  />
                </View>
              </View>
            );
          })}
          {ranked.length === 0 ? <Text tone="muted">No spending in this range.</Text> : null}
        </Card>
      </Section>
      <Section title="Income vs spending by month">
        <Card className="gap-3">
          <View className="flex-row gap-4">
            <LegendDot color={chart.moneyIn} label="Income" />
            <LegendDot color={chart.moneyOut} label="Spending" />
          </View>
          {hidden ? (
            <Text tone="muted">Hidden in privacy mode.</Text>
          ) : (
            <BarChart
              data={monthBars}
              barWidth={12}
              spacing={18}
              roundedTop
              noOfSections={3}
              hideRules={false}
              {...axis}
            />
          )}
          {(series.data ?? []).map((m) => (
            <View key={m.month} className="flex-row justify-between">
              <Text variant="caption" tone="muted">
                {formatMonth(m.month)}
              </Text>
              <Text variant="caption" numeric>
                {hidden
                  ? "•••"
                  : `${formatAmount(m.incomeMinor)} in · ${formatAmount(m.spentMinor)} out`}
              </Text>
            </View>
          ))}
        </Card>
      </Section>
      <Section title="Net worth">
        <Card className="gap-2">
          {worthPoints.length && !hidden ? (
            <LineChart
              data={worthPoints}
              color={chart.moneyIn}
              thickness={2}
              hideDataPoints={false}
              dataPointsColor={chart.moneyIn}
              dataPointsRadius={4}
              curved
              noOfSections={3}
              {...axis}
            />
          ) : null}
          {worth.data ? (
            <Amount minor={worth.data.series.at(-1)?.netWorthMinor ?? 0} variant="heading" />
          ) : null}
          {worth.data?.excludedAccounts.length ? (
            <Text variant="caption" tone="muted">
              Not counted (other currency):{" "}
              {worth.data.excludedAccounts.map((a) => a.name).join(", ")}
            </Text>
          ) : null}
        </Card>
      </Section>
      <Section title="By area">
        <Card className="gap-2">
          {areas.map((area) => {
            const spent = data?.spendingByArea.find((r) => r.areaId === area.id)?.amountMinor ?? 0;
            const hours = data?.hoursByArea.find((r) => r.areaId === area.id)?.minutes ?? 0;
            const rate = data?.hourlyRates.find((r) => r.areaId === area.id)?.rateMinor ?? null;
            if (!spent && !hours && !rate) return null;
            return (
              <View key={area.id} className="flex-row items-center justify-between gap-2">
                <Text className="flex-1">
                  {area.emoji} {area.name}
                </Text>
                <Text variant="caption" tone="muted" numeric>
                  {formatMinutes(hours)} · spent {hidden ? "•••" : formatAmount(spent)}
                  {rate ? ` · ${hidden ? "•••" : formatAmount(rate)}/h` : ""}
                </Text>
              </View>
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}
