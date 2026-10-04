import { useQueryClient } from "@tanstack/react-query";
import { SPARKS } from "@tick-taka/shared/gamification";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";
import { useOutbox } from "@/lib/outbox";
import type { TodayData } from "@/lib/queries";
import { awardSparks } from "@/lib/sparks";
import { updateToday } from "@/lib/today-cache";

type Habit = TodayData["habits"][number];
const SIZE = 64;
const R = 28;
const CIRCUMFERENCE = 2 * Math.PI * R;

function HabitChip({
  habit,
  onTap,
  onReset,
}: {
  habit: Habit;
  onTap: () => void;
  onReset: () => void;
}) {
  const progress = Math.min(1, habit.todayCount / habit.targetCount);
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onReset}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${habit.todayCount} of ${habit.targetCount}${habit.doneToday ? ", done" : ""}`}
      accessibilityHint="Tap to check off, long-press to reset"
      className="items-center gap-1"
    >
      <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={habit.color}
            strokeOpacity={0.25}
            strokeWidth={5}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={habit.color}
            strokeWidth={5}
            fill={habit.doneToday ? habit.color : "none"}
            fillOpacity={0.2}
            strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
            strokeOpacity={progress === 0 ? 0 : 1}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text className="text-2xl">{habit.emoji}</Text>
      </View>
      <Text variant="caption" numberOfLines={1} className="max-w-16">
        {habit.name}
      </Text>
      <Text variant="caption" tone="grape" numeric>
        {habit.targetCount > 1
          ? `${habit.todayCount}/${habit.targetCount}`
          : habit.streak.current > 0
            ? `🔥 ${habit.streak.current}`
            : " "}
      </Text>
    </Pressable>
  );
}

export function HabitChips({ data }: { data: TodayData }) {
  const client = useQueryClient();
  const send = useOutbox();
  const router = useRouter();
  const setCount = (habit: Habit, count: number) => {
    const done = count >= habit.targetCount;
    updateToday(client, (d) => ({
      ...d,
      habits: d.habits.map((h) =>
        h.id === habit.id ? { ...h, todayCount: count, doneToday: done } : h,
      ),
    }));
    send({
      method: "PUT",
      path: `/habits/${habit.id}/logs/${data.date}`,
      body: { count },
      label: `Couldn't update ${habit.name}`,
    });
    if (done && !habit.doneToday) awardSparks(SPARKS.habitChecked);
  };
  return (
    <Section title="Habits" action="All" onAction={() => router.push("/plan/habits")}>
      {data.habits.length === 0 ? (
        <Pressable onPress={() => router.push("/plan/habits")} className="px-1">
          <Text tone="muted">Add a small habit, like water or a walk.</Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-4 px-1"
        >
          {data.habits.map((habit) => (
            <HabitChip
              key={habit.id}
              habit={habit}
              onTap={() =>
                setCount(habit, habit.todayCount >= habit.targetCount ? 0 : habit.todayCount + 1)
              }
              onReset={() => {
                haptic.tap();
                setCount(habit, 0);
              }}
            />
          ))}
        </ScrollView>
      )}
    </Section>
  );
}
