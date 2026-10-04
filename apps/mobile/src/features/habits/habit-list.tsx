import { useRouter } from "expo-router";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useHabits } from "./queries";

const SCHEDULE_LABEL = {
  daily: "Every day",
  weekly: "Once a week",
  n_per_week: "times a week",
} as const;

/** Habits with streaks; two freeze days a month keep one bad day from breaking a run. */
export function HabitList() {
  const router = useRouter();
  const habits = useHabits();
  const list = habits.data ?? [];
  return (
    <Screen
      title="Habits"
      subtitle="Small repeated actions"
      tabBarPadding={false}
      right={<Button label="New" size="sm" icon="plus" onPress={() => router.push("/habit/new")} />}
    >
      <AsyncContent
        query={habits}
        skeleton={
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        }
        isEmpty={() => list.length === 0}
        empty={
          <EmptyState
            title="No habits yet"
            message="Start with one tiny habit. Small steps, done often, add up."
            actionLabel="Add a habit"
            onAction={() => router.push("/habit/new")}
          />
        }
      >
        {() =>
          list.map((habit) => {
            const weekTarget =
              habit.schedule === "daily"
                ? 7
                : habit.schedule === "weekly"
                  ? 1
                  : (habit.perWeek ?? 1);
            return (
              <Card
                key={habit.id}
                onPress={() => router.push(`/habit/${habit.id}`)}
                className="gap-2"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl">{habit.emoji}</Text>
                  <View className="flex-1">
                    <Text variant="strong">{habit.name}</Text>
                    <Text variant="caption" tone="muted">
                      {habit.schedule === "n_per_week"
                        ? `${habit.perWeek} ${SCHEDULE_LABEL.n_per_week}`
                        : SCHEDULE_LABEL[habit.schedule]}
                      {habit.targetCount > 1 ? ` · ${habit.targetCount} a day` : ""}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text variant="heading" tone="grape" numeric>
                      🔥 {habit.streak.current}
                    </Text>
                    <Text variant="caption" tone="muted">
                      best {habit.streak.best} {habit.streak.unit}s
                    </Text>
                  </View>
                </View>
                <ProgressBar value={habit.weekDoneDays / weekTarget} tone="grape" />
                <Text variant="caption" tone="muted">
                  {habit.weekDoneDays}/{weekTarget} this week · {habit.streak.freezesLeftThisMonth}{" "}
                  freeze day{habit.streak.freezesLeftThisMonth === 1 ? "" : "s"} left this month
                </Text>
              </Card>
            );
          })
        }
      </AsyncContent>
    </Screen>
  );
}
