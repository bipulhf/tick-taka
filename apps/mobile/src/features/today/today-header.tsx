import { View } from "react-native";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { Text } from "@/components/ui/text";
import { formatLocalDate } from "@/lib/format";
import type { TodayData } from "@/lib/queries";

/** Date, greeting and Tiki's mood: the first thing the day says. */
export function TodayHeader({ data, outfit }: { data: TodayData; outfit: TikiOutfit }) {
  const goal = data.gamification.dailyGoal;
  const goalText = goal.onVacation
    ? "On vacation"
    : goal.isDayOff
      ? "Day off"
      : `${goal.doneToday} of ${goal.goal} done`;
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text variant="callout" tone="muted" numberOfLines={1} className="flex-1">
          {formatLocalDate(data.date, "long")} · {goalText}
        </Text>
        <PrivacyToggle />
      </View>
      <View className="flex-row items-center gap-4">
        <View className="flex-1 gap-1">
          <Text variant="largeTitle" accessibilityRole="header">
            {data.greeting}
          </Text>
          <Text variant="callout" tone="muted" numberOfLines={2}>
            {data.tiki.line}
          </Text>
        </View>
        <Tiki mood={data.tiki.mood} size={72} outfit={outfit} />
      </View>
    </View>
  );
}
