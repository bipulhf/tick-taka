import {
  addDays,
  daysInMonth,
  endOfLocalDay,
  firstDayOfMonth,
  localMonthRange,
  startOfLocalDay,
  startOfWeek,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { CALENDAR_GRID } from "@/components/ui/calendar-grid";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthStepper } from "@/components/ui/month-stepper";
import { Screen } from "@/components/ui/screen";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatAmount, formatLocalDate, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { useInsights, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6];

/** A month grid of daily spending; tap a spike to see what it was. */
export function MoneyCalendar() {
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const hidden = usePrivacy();
  const timeZone = userTime(settings).timeZone;
  const weekStartsOn = userTime(settings).weekStartsOn;
  const today = useTodayDate();
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
      right={<MonthStepper month={month} onChange={setMonth} />}
    >
      <AsyncContent
        query={insights}
        skeleton={<Skeleton className="h-[26rem] w-full rounded-3xl" />}
      >
        {() => (
          <Card className="flex-row flex-wrap" style={CALENDAR_GRID}>
            {WEEK_OFFSETS.map((i) => (
              <Text
                key={`weekday-${(weekStartsOn + i) % 7}`}
                variant="caption"
                tone="muted"
                className="w-[14.28%] pb-1 text-center"
              >
                {WEEKDAYS[(weekStartsOn + i) % 7]}
              </Text>
            ))}
            {cells.map((date) => {
              const spent = byDay.get(date) ?? 0;
              const inMonth = date.slice(0, 7) === month;
              const isSelected = date === selected;
              return (
                <Pressable
                  key={date}
                  onPress={() => setSelected(date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${formatLocalDate(date)}, spent ${hidden ? "amount hidden" : formatAmount(spent)}`}
                  // Neutral cells with a small coral mark sized by the day's spend, not a heat fill.
                  className={`min-h-16 w-[14.28%] items-center justify-center gap-1.5 rounded-xl py-1 ${isSelected ? "bg-ink" : ""}`}
                >
                  <Text
                    variant="caption"
                    tone={isSelected ? "background" : inMonth ? "ink" : "muted"}
                    numeric
                    maxFontSizeMultiplier={1.3}
                  >
                    {Number(date.slice(8))}
                  </Text>
                  <View className="h-1 w-4/5 items-center">
                    {spent > 0 && inMonth ? (
                      <View
                        className={`h-1 rounded-full ${isSelected ? "bg-background" : "bg-coral-text"}`}
                        style={{ width: `${Math.max(20, (spent / max) * 100)}%` }}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}
      </AsyncContent>
      {/* The selected day's spend, at a readable size, instead of a figure in every cell. */}
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="heading" className="flex-1">
          {formatLocalDate(selected, "long")}
        </Text>
        {insights.data ? (
          <Text variant="callout" tone="muted">
            Spent{" "}
            <Amount
              minor={byDay.get(selected) ?? 0}
              variant="callout"
              className="font-nunito-bold"
              animate={false}
            />
          </Text>
        ) : null}
      </View>
      <AsyncContent
        query={dayTx}
        skeleton={<SkeletonList rows={3} trailing />}
        isEmpty={(data) => data.pages.every((p) => p.items.length === 0)}
        empty={
          <EmptyState
            title="Nothing logged this day"
            message="A quiet day for your wallet. Tap another day to see where money moved."
            mood="relaxed"
          />
        }
      >
        {(data) => (
          <Card className="py-1">
            {data.pages
              .flatMap((p) => p.items)
              .map((tx) => (
                <TransactionRow key={tx.id} tx={tx} lookup={lookup} placement="card" />
              ))}
          </Card>
        )}
      </AsyncContent>
    </Screen>
  );
}
