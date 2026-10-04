import type { ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { Icon, type IconName } from "./icon";

const THRESHOLD = 80;

export interface SwipeAction {
  icon: IconName;
  /** Background class, e.g. "bg-mint" */
  className: string;
  onTrigger: () => void;
}

/** Swipe right to complete or check off; swipe left to snooze or edit. */
export function SwipeRow({
  children,
  right,
  left,
}: {
  children: ReactNode;
  right?: SwipeAction;
  left?: SwipeAction;
}) {
  const x = useSharedValue(0);
  const trigger = (action: SwipeAction | undefined) => {
    if (!action) return;
    haptic.tap();
    action.onTrigger();
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const max = event.translationX > 0 ? (right ? 140 : 0) : left ? -140 : 0;
      x.value =
        event.translationX > 0
          ? Math.min(event.translationX, max)
          : Math.max(event.translationX, max);
    })
    .onEnd(() => {
      if (x.value > THRESHOLD) runOnJS(trigger)(right);
      else if (x.value < -THRESHOLD) runOnJS(trigger)(left);
      x.value = withSpring(0, { damping: 18 });
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const rightHint = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, THRESHOLD], [0, 1]),
  }));
  const leftHint = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-THRESHOLD, 0], [1, 0]),
  }));
  return (
    <View className="overflow-hidden rounded-2xl">
      {right ? (
        <Animated.View
          style={rightHint}
          className={`absolute inset-0 justify-center rounded-2xl pl-5 ${right.className}`}
        >
          <Icon name={right.icon} color="white" />
        </Animated.View>
      ) : null}
      {left ? (
        <Animated.View
          style={leftHint}
          className={`absolute inset-0 items-end justify-center rounded-2xl pr-5 ${left.className}`}
        >
          <Icon name={left.icon} color="white" />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
