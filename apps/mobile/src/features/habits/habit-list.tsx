import { useRouter } from "expo-router";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { bestText, weekProgressText } from "@/lib/gentle-progress";
import { useRemove } from "@/lib/use-remove";
import { useHabits } from "./queries";
import { useArchiveHabit } from "./use-archive-habit";

const SCHEDULE_LABEL = {
  daily: "Every day",
  weekly: "Once a week",
  n_per_week: "times a week",
} as const;

/** Habits with streaks; two freeze days a month keep one bad day from breaking a run. */
export function HabitList() {
  const router = useRouter();
  const remove = useRemove();
  const archive = useArchiveHabit();
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
              <SwipeRow
                key={habit.id}
                actions={[
                  {
                    label: "Edit",
                    icon: "pencil-outline",
                    tone: "sky",
                    onPress: () => router.push(`/habit/${habit.id}`),
                  },
                  {
                    label: "Archive",
                    icon: "archive-outline",
                    tone: "muted",
                    onPress: () => archive(habit),
                  },
                  {
                    label: "Delete",
                    icon: "trash-can-outline",
                    tone: "coral",
                    onPress: () => remove(`/habits/${habit.id}`, `“${habit.name}”`),
                  },
                ]}
              >
                <Card onPress={() => router.push(`/habit/${habit.id}`)} className="gap-2">
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
                      {habit.streak.current > 0 ? (
                        <Text variant="heading" tone="grape" numeric>
                          🔥 {habit.streak.current}
                        </Text>
                      ) : null}
                      {bestText(habit.streak.best, habit.streak.unit) ? (
                        <Text variant="caption" tone="muted">
                          {bestText(habit.streak.best, habit.streak.unit)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {/* Days done, as dots: the week is counted up, never shown as days short. */}
                  <View className="flex-row gap-1.5" accessible={false}>
                    {Array.from({ length: Math.min(7, weekTarget) }, (_, i) => (
                      <View
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length row of dots
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${i < habit.weekDoneDays ? "bg-grape" : "bg-line"}`}
                      />
                    ))}
                  </View>
                  <Text variant="caption" tone="muted">
                    {weekProgressText(habit.weekDoneDays, weekTarget, habit.schedule === "daily")} ·{" "}
                    {plural(habit.streak.freezesLeftThisMonth, "freeze day")} left this month
                  </Text>
                </Card>
              </SwipeRow>
            );
          })
        }
      </AsyncContent>
    </Screen>
  );
}
