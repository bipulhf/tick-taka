import { useEffect } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** One placeholder shape that gently pulses while data loads (still when motion is reduced). */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 750 }), -1, true);
  }, [opacity, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      className={`rounded-full bg-line ${className ?? ""}`}
      style={[pulse, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Varied line lengths so a placeholder list reads as text, not a grid. */
const WIDTHS = ["62%", "48%", "70%", "55%", "40%", "66%"] as const;
/** Stable keys for fixed placeholder rows. */
const KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const keys = (count: number) => KEYS.slice(0, Math.min(count, KEYS.length));

/** Placeholder for a grouped list of rows (ListRow, TaskRow, TransactionRow). */
export function SkeletonList({
  rows = 4,
  leading = "circle",
  trailing = false,
}: {
  rows?: number;
  leading?: "circle" | "none";
  trailing?: boolean;
}) {
  return (
    <View
      className="overflow-hidden rounded-3xl bg-card"
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {keys(rows).map((key, index) => (
        <View
          key={key}
          className={`min-h-[60px] flex-row items-center gap-3 px-4 py-3 ${index > 0 ? "border-t border-line" : ""}`}
        >
          {leading === "circle" ? <Skeleton className="h-10 w-10" /> : null}
          <View className="flex-1 gap-2">
            <Skeleton className="h-4" style={{ width: WIDTHS[index % WIDTHS.length] }} />
            <Skeleton
              className="h-3"
              style={{ width: WIDTHS[(index + 3) % WIDTHS.length], opacity: 0.7 }}
            />
          </View>
          {trailing ? <Skeleton className="h-4 w-14" /> : null}
        </View>
      ))}
    </View>
  );
}

/** Placeholder for a card: a label, a headline (big for hero numbers) and a few lines. */
export function SkeletonCard({ hero = false, lines = 2 }: { hero?: boolean; lines?: number }) {
  return (
    <View
      className="gap-3 rounded-3xl bg-card p-5"
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className={hero ? "h-11 w-1/2 rounded-2xl" : "h-5 w-2/3"} />
      {keys(lines).map((key, index) => (
        <Skeleton
          key={key}
          className="h-3"
          style={{ width: WIDTHS[(index + 1) % WIDTHS.length] }}
        />
      ))}
    </View>
  );
}

/** Placeholder for an edit sheet while the record loads: labelled fields. */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <View className="gap-5" accessibilityLabel="Loading" accessibilityRole="progressbar">
      {keys(fields).map((key) => (
        <View key={key} className="gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </View>
      ))}
    </View>
  );
}
