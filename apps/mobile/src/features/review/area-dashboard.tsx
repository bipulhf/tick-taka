import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatMinutes } from "@/lib/format";
import { useAreaDashboard } from "./queries";

/** For each area: hours this week, money in and out this month, open tasks. */
export function AreaDashboard() {
  const router = useRouter();
  const dashboard = useAreaDashboard();
  return (
    <Screen title="Areas" subtitle="How each part of life is going" tabBarPadding={false}>
      <AsyncContent
        query={dashboard}
        skeleton={
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            title="No areas yet"
            message="Add areas like Work or Home to see each part of life here."
            actionLabel="Set up areas"
            onAction={() => router.push("/settings/areas")}
          />
        }
      >
        {(data) =>
          data.map((row) => (
            <Card
              key={row.area.id}
              onPress={() => router.push(`/plan/area/${row.area.id}`)}
              className="gap-2"
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: row.area.color }}
                />
                <Text variant="strong" className="flex-1">
                  {row.area.emoji} {row.area.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {row.openTasks} open
                </Text>
              </View>
              <View className="flex-row justify-between">
                <View>
                  <Text variant="label" tone="muted">
                    Week
                  </Text>
                  <Text variant="heading" numeric>
                    {formatMinutes(row.weekMinutes)}
                  </Text>
                </View>
                <View className="items-center">
                  <Text variant="label" tone="muted">
                    In
                  </Text>
                  <Amount minor={row.monthIncomeMinor} variant="heading" animate={false} />
                </View>
                <View className="items-end">
                  <Text variant="label" tone="muted">
                    Out
                  </Text>
                  <Amount minor={row.monthSpentMinor} variant="heading" animate={false} />
                </View>
              </View>
            </Card>
          ))
        }
      </AsyncContent>
    </Screen>
  );
}
