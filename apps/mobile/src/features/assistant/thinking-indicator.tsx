import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Tiki } from "@/components/tiki/tiki";
import { Text } from "@/components/ui/text";
import { useColors } from "@/theme/colors";

/** Three neutral dots: purple means habits and mango the primary action, so neither waves here. */
const DOTS = ["first", "second", "third"];
const THINKING = ["Thinking", "Reading your day", "Doing the sums", "Almost there"];
const WORKING = ["Working on it", "Checking the results", "Tidying up"];

/** One dot of the wave: hops up, glows and settles, a beat after the one before. */
function Dot({ color, index }: { color: string; index: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 260 }),
        ),
        -1,
      ),
    );
  }, [index, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + t.value * 0.55,
    transform: [{ translateY: -6 * t.value }, { scale: 0.85 + t.value * 0.35 }],
  }));
  return (
    <Animated.View
      style={[style, { backgroundColor: color }]}
      className="h-2.5 w-2.5 rounded-full"
    />
  );
}

/** Tiki at work: a little wave of dots and a line that changes as it goes. */
export function ThinkingIndicator({ working = false }: { working?: boolean }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const lines = working ? WORKING : THINKING;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), 2200);
    return () => clearInterval(timer);
  }, [lines]);
  return (
    <View
      className="flex-row items-center gap-3"
      accessibilityRole="progressbar"
      accessibilityLabel={working ? "Tiki is working" : "Tiki is thinking"}
    >
      <Tiki mood="focused" size={28} />
      <View className="h-4 flex-row items-end gap-1.5">
        {DOTS.map((dot, i) => (
          <Dot key={dot} color={colors.muted} index={i} />
        ))}
      </View>
      <Animated.View
        key={lines[index]}
        entering={reduceMotion ? undefined : FadeInDown.duration(260)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(200)}
      >
        <Text variant="callout" tone="muted">
          {lines[index]}…
        </Text>
      </Animated.View>
    </View>
  );
}

/** The blinking caret at the end of a reply that's still arriving. */
export function StreamingCaret() {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    on.value = withRepeat(
      withSequence(withTiming(0.15, { duration: 450 }), withTiming(1, { duration: 450 })),
      -1,
    );
  }, [on, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return <Animated.View style={style} className="ml-0.5 h-4 w-1.5 rounded-full bg-mango" />;
}
