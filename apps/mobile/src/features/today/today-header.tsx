import { Pressable, View } from "react-native";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatLocalDate } from "@/lib/format";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import type { TodayData } from "@/lib/queries";

/** Date, greeting and Tiki's mood: the first thing the day says. */
export function TodayHeader({ data, outfit }: { data: TodayData; outfit: TikiOutfit }) {
  const privacy = usePrivacy();
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
        <Pressable
          onPress={togglePrivacy}
          hitSlop={6}
          accessibilityRole="switch"
          accessibilityState={{ checked: privacy }}
          accessibilityLabel="Hide amounts"
          className="h-12 w-12 items-center justify-center"
        >
          <Icon name={privacy ? "eye-off-outline" : "eye-outline"} color="muted" />
        </Pressable>
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
