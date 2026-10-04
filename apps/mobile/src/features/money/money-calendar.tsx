import {
  addDays,
  addMonths,
  daysInMonth,
  endOfLocalDay,
  firstDayOfMonth,
  localMonthRange,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useInsights, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

/** A month grid of daily spending; tap a spike to see what it was. */
export function MoneyCalendar() {
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const hidden = usePrivacy();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const weekStartsOn = settings?.weekStartsOn ?? 6;
  const today = toLocalDate(Date.now(), timeZone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = localMonthRange(month, timeZone);
  const insights = useInsights(range.from, range.to);
  const dayTx = useTransactions({
    from: String(startOfLocalDay(selected, timeZone)),
    to: String(endOfLocalDay(selected, timeZone)),
    limit: "100",
  });
  const lookup = useLookup(accounts, categories);
  const byDay = new Map((insights.data?.byDay ?? []).map((d) => [d.date, d.spentMinor]));
  const max = Math.max(1, ...byDay.values());
  const leading = (weekdayOf(firstDayOfMonth(month)) - weekStartsOn + 7) % 7;
  const cells = Array.from({ length: Math.ceil((leading + daysInMonth(month)) / 7) * 7 }, (_, i) =>
    addDays(startOfWeek(firstDayOfMonth(month), weekStartsOn), i),
  );
  return (
    <Screen
      title={formatMonth(month)}
      subtitle={
        insights.data
          ? `Spent ${hidden ? "•••" : formatAmount(insights.data.totals.spentMinor)}`
          : undefined
      }
      tabBarPadding={false}
      right={
        <View className="flex-row">
          <Pressable
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityLabel="Previous month"
          >
            <Icon name="chevron-left" />
          </Pressable>
          <Pressable
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, 1))}
            accessibilityLabel="Next month"
          >
            <Icon name="chevron-right" />
          </Pressable>
        </View>
      }
    >
      <Card className="flex-row flex-wrap p-2">
        {cells.map((date) => {
          const spent = byDay.get(date) ?? 0;
          const inMonth = date.slice(0, 7) === month;
          const intensity = spent / max;
          return (
            <Pressable
              key={date}
              onPress={() => setSelected(date)}
              accessibilityLabel={`${formatLocalDate(date)}, spent ${formatAmount(spent)}`}
              className={`h-16 w-[14.28%] items-center justify-center rounded-xl ${date === selected ? "border-2 border-coral" : ""}`}
              style={{
                backgroundColor:
                  spent > 0 && inMonth ? `rgba(255,122,107,${0.12 + intensity * 0.55})` : undefined,
              }}
            >
              <Text variant="caption" tone={inMonth ? "ink" : "muted"} numeric>
                {Number(date.slice(8))}
              </Text>
              {spent > 0 && inMonth ? (
                <Text className="text-[9px]" numeric numberOfLines={1}>
                  {hidden
                    ? "•"
                    : spent >= 100_000
                      ? `${Math.round(spent / 100_000)}k`
                      : Math.round(spent / 100)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Card>
      <Text variant="heading">{formatLocalDate(selected, "long")}</Text>
      <Card className="py-1">
        {(dayTx.data?.pages.flatMap((p) => p.items) ?? []).map((tx) => (
          <TransactionRow key={tx.id} tx={tx} lookup={lookup} />
        ))}
      </Card>
    </Screen>
  );
}
