import { useEffect, useState } from "react";
import { Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { createStore, useStore } from "@/lib/store";

/** Big wins only: all top three done, a savings goal reached, a 30-day streak. */
export const confettiStore = createStore(0);
export const celebrate = () => confettiStore.set(confettiStore.get() + 1);

const COLORS = ["#FFB547", "#5B8CFF", "#2EC4A0", "#FF7A6B", "#A57BFF"];
const PIECE_IDS = Array.from({ length: 36 }, (_, i) => i);

function Piece({ index }: { index: number }) {
  const { width, height } = Dimensions.get("window");
  const progress = useSharedValue(0);
  // Pieces are keyed by run, so each burst remounts them with fresh random paths.
  const [seed] = useState(() => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 160,
    spin: Math.random() * 720,
    delay: Math.random() * 250,
  }));
  useEffect(() => {
    progress.value = withDelay(
      seed.delay,
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, seed]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: seed.x + seed.drift * progress.value },
      { translateY: -20 + height * 0.8 * progress.value },
      { rotate: `${seed.spin * progress.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 8,
          height: 14,
          borderRadius: 2,
          backgroundColor: COLORS[index % COLORS.length],
        },
        style,
      ]}
    />
  );
}

export function ConfettiLayer() {
  const run = useStore(confettiStore);
  const reduceMotion = useReducedMotion();
  if (run === 0 || reduceMotion) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
      {PIECE_IDS.map((id) => (
        <Piece key={`${run}-${id}`} index={id} />
      ))}
    </View>
  );
}
