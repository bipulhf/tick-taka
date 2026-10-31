import {
  addDays,
  daysInMonth,
  firstDayOfMonth,
  localMonthRange,
  startOfWeek,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { CALENDAR_GRID } from "@/components/ui/calendar-grid";
import { Card } from "@/components/ui/card";
import { MonthStepper } from "@/components/ui/month-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatAmount, formatLocalDate, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { useInsights } from "./queries";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Transactions' month view: a grid of daily spending; tap a spike to see what it was
 * (the list below shows that day). `selected` is the picked day, if any.
 */
export function SpendingMonth({
  month,
  onMonth,
  selected,
  onSelect,
}: {
  month: string;
  onMonth: (month: string) => void;
  selected: string | undefined;
  onSelect: (date: string | undefined) => void;
}) {
  const { data: settings } = useSettings();
  const hidden = usePrivacy();
  const timeZone = userTime(settings).timeZone;
  const weekStartsOn = userTime(settings).weekStartsOn;
  const range = localMonthRange(month, timeZone);
  const insights = useInsights(range.from, range.to);
  const byDay = new Map((insights.data?.byDay ?? []).map((d) => [d.date, d.spentMinor]));
  const max = Math.max(1, ...byDay.values());
  const leading = (weekdayOf(firstDayOfMonth(month)) - weekStartsOn + 7) % 7;
  const cells = Array.from({ length: Math.ceil((leading + daysInMonth(month)) / 7) * 7 }, (_, i) =>
    addDays(startOfWeek(firstDayOfMonth(month), weekStartsOn), i),
  );
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="heading" className="flex-1">
          {formatMonth(month)}
        </Text>
        <MonthStepper month={month} onChange={onMonth} />
      </View>
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
                  onPress={() => onSelect(date)}
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
      {/* The picked day's (or the month's) spend, at a readable size, instead of a figure in every cell. */}
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="heading" className="flex-1">
          {selected ? formatLocalDate(selected, "long") : "All days"}
        </Text>
        {insights.data ? (
          <Text variant="callout" tone="muted">
            Spent{" "}
            <Amount
              minor={selected ? (byDay.get(selected) ?? 0) : insights.data.totals.spentMinor}
              variant="callout"
              className="font-nunito-bold"
              animate={false}
            />
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Button
          label="All days"
          variant="secondary"
          size="sm"
          onPress={() => onSelect(undefined)}
        />
      ) : null}
    </View>
  );
}
