import { addDays, startOfLocalDay, startOfWeek } from "@tick-taka/shared/dates";
import { useState } from "react";
import { View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChartAxis } from "@/components/ui/chart-axis";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { useAreas, useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { useColors } from "@/theme/colors";
import { useFocusStats } from "./queries";

/** Weekly focus minutes per area, e.g. how much deep work Research actually got. */
export function FocusStats() {
  const colors = useColors();
  const axis = useChartAxis();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = userTime(settings).timeZone;
  const today = useTodayDate();
  const [weeksBack, setWeeksBack] = useState(0);
  const weekStart = addDays(startOfWeek(today, userTime(settings).weekStartsOn), -7 * weeksBack);
  const stats = useFocusStats(
    startOfLocalDay(weekStart, timeZone),
    startOfLocalDay(addDays(weekStart, 7), timeZone),
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const bars = days.map((day) => ({
    value: Math.round(stats.data?.byDay.find((d) => d.date === day)?.minutes ?? 0),
    label: formatLocalDate(day).slice(0, 2),
    frontColor: colors.sky,
  }));
  return (
    <Screen title="Focus" subtitle={`Week of ${formatLocalDate(weekStart)}`} tabBarPadding={false}>
      <AsyncContent
        query={stats}
        skeleton={
          <>
            <SkeletonCard hero lines={1} />
            <Skeleton className="h-56 w-full rounded-3xl" />
            <SkeletonCard lines={3} />
          </>
        }
        isEmpty={(data) => data.sessions === 0}
        empty={
          <EmptyState
            title="No focus sessions this week"
            message="Each session lands here, so you can see where your deep work went."
            mood="calm"
          />
        }
      >
        {() => (
          <>
            <Card className="gap-1">
              <Text variant="display" numeric>
                {formatMinutes(stats.data?.totalMinutes ?? 0)}
              </Text>
              <Text tone="muted">{plural(stats.data?.sessions ?? 0, "focus session")}</Text>
            </Card>
            <Card>
              <BarChart
                data={bars}
                barWidth={22}
                spacing={18}
                roundedTop
                noOfSections={3}
                {...axis}
                hideRules
              />
            </Card>
            <Card className="gap-2">
              <Text variant="label" tone="muted">
                By area
              </Text>
              {(stats.data?.byArea ?? []).map((row) => {
                const area = areas.find((a) => a.id === row.areaId);
                return (
                  <View key={row.areaId ?? "none"} className="flex-row justify-between">
                    <Text>{area ? `${area.emoji} ${area.name}` : "No area"}</Text>
                    <Text variant="strong" numeric>
                      {formatMinutes(row.minutes)}
                    </Text>
                  </View>
                );
              })}
              {stats.data?.byArea.length === 0 ? (
                <Text tone="muted">No focus sessions this week.</Text>
              ) : null}
            </Card>
          </>
        )}
      </AsyncContent>
      <View className="flex-row gap-2">
        <Button
          label="Earlier"
          variant="secondary"
          size="sm"
          onPress={() => setWeeksBack(weeksBack + 1)}
          className="flex-1"
        />
        <Button
          label="Later"
          variant="secondary"
          size="sm"
          disabled={weeksBack === 0}
          onPress={() => setWeeksBack(weeksBack - 1)}
          className="flex-1"
        />
      </View>
    </Screen>
  );
}
