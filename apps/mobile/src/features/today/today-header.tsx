import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { Icon } from "@/components/ui/icon";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { Text } from "@/components/ui/text";
import { formatClock, formatLocalDate } from "@/lib/format";
import type { TodayData } from "@/lib/queries";
import { nextThing } from "./next-thing";

/**
 * Date, a one-line greeting beside Tiki, and the next thing to do: compact, so
 * safe-to-spend and the top three sit above the fold.
 */
export function TodayHeader({
  data,
  outfit,
  timeZone,
}: {
  data: TodayData;
  outfit: TikiOutfit;
  timeZone: string;
}) {
  const router = useRouter();
  const goal = data.gamification.dailyGoal;
  const goalText = goal.onVacation
    ? "On vacation"
    : goal.isDayOff
      ? "Day off"
      : `${goal.doneToday} of ${goal.goal} done`;
  const next = nextThing(data, Date.now());
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="callout" tone="muted" numberOfLines={1} className="flex-1">
          {formatLocalDate(data.date, "long")} · {goalText}
        </Text>
        <PrivacyToggle />
      </View>
      <View className="flex-row items-center gap-3">
        <Tiki mood={data.tiki.mood} size={52} outfit={outfit} />
        <View className="flex-1">
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {data.greeting}
          </Text>
          <Text variant="callout" tone="muted" numberOfLines={2}>
            {data.tiki.line}
          </Text>
        </View>
      </View>
      {next ? (
        <Pressable
          onPress={() => router.push(`/task/${next.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Next: ${next.title}${next.at ? ` at ${formatClock(next.at, timeZone)}` : ""}`}
          accessibilityHint="Opens the task"
          className="min-h-12 flex-row items-center gap-2 rounded-2xl bg-card px-4 py-2 active:opacity-80"
        >
          <Icon name="arrow-right-circle-outline" size={20} color="sky" />
          <Text variant="strong" numberOfLines={1} className="flex-1">
            <Text variant="strong" tone="muted">
              Next:{" "}
            </Text>
            {next.title}
          </Text>
          {next.at ? (
            <Text variant="callout" tone="sky" numeric>
              {formatClock(next.at, timeZone)}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
