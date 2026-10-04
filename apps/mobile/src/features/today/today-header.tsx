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

function SparkPill({
  level,
  sparks,
  goal,
}: {
  level: number;
  sparks: number;
  goal: { doneToday: number; goal: number; isDayOff: boolean; onVacation: boolean };
}) {
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
  const goalText = goal.onVacation
    ? "On vacation"
    : goal.isDayOff
      ? "Day off"
      : `${goal.doneToday}/${goal.goal} today`;
  return (
    <View className="items-end">
      <View className="flex-row items-center gap-1 rounded-full bg-card px-3 py-1.5">
        <Text>✨</Text>
        <Text variant="caption" className="font-nunito-bold" numeric>
          {sparks} · Lv {level}
        </Text>
      </View>
      <Text variant="caption" tone="muted" className="mt-1">
        {goalText}
      </Text>
      {burst ? (
        <Animated.View
          style={[{ position: "absolute", right: 12, top: -4 }, burstStyle]}
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

export function TodayHeader({ data, outfit }: { data: TodayData; outfit: TikiOutfit }) {
  const privacy = usePrivacy();
  return (
    <View className="flex-row items-center gap-3">
      <Tiki mood={data.tiki.mood} size={76} outfit={outfit} />
      <View className="flex-1">
        <Text variant="title" accessibilityRole="header">
          {data.greeting}
        </Text>
        <Text tone="muted">{formatLocalDate(data.date, "long")}</Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {data.tiki.line}
        </Text>
      </View>
      <View className="items-end gap-2">
        <SparkPill
          level={data.gamification.level.level}
          sparks={data.gamification.sparks}
          goal={data.gamification.dailyGoal}
        />
        <Pressable
          onPress={togglePrivacy}
          hitSlop={10}
          accessibilityRole="switch"
          accessibilityState={{ checked: privacy }}
          accessibilityLabel="Privacy mode"
          className="h-10 w-10 items-center justify-center"
        >
          <Icon name={privacy ? "eye-off-outline" : "eye-outline"} color="muted" />
        </Pressable>
      </View>
    </View>
  );
}
