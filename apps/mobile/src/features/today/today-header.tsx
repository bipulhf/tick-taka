import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatLocalDate } from "@/lib/format";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import type { TodayData } from "@/lib/queries";
import { sparkBurstStore } from "@/lib/sparks";
import { useStore } from "@/lib/store";

/** Sparks and level, with the "+10" that floats up when something is finished. */
function SparkPill({ level, sparks }: { level: number; sparks: number }) {
  const burst = useStore(sparkBurstStore);
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!burst) return;
    rise.value = 0;
    rise.value = withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 0 }));
  }, [burst, rise]);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: rise.value === 0 ? 0 : 1 - rise.value * 0.6,
    transform: [{ translateY: -24 * rise.value }],
  }));
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full bg-card px-3 py-2"
      accessibilityLabel={`${sparks} sparks, level ${level}`}
    >
      <Text variant="callout">✨</Text>
      <Text variant="callout" className="font-nunito-bold" numeric>
        {sparks}
      </Text>
      <Text variant="caption" tone="muted">
        Lv {level}
      </Text>
      {burst ? (
        <Animated.View
          style={[{ position: "absolute", right: 10, top: -6 }, burstStyle]}
          pointerEvents="none"
        >
          <Text variant="strong" tone="mango">
            +{burst.amount}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

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
        <View className="flex-row items-center gap-1">
          <SparkPill level={data.gamification.level.level} sparks={data.gamification.sparks} />
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
