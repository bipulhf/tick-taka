import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { Icon } from "./icon";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "md" | "lg";
  tone?: "sky" | "grape" | "mint";
  label: string;
}

const RING = { sky: "border-sky", grape: "border-grape", mint: "border-mint" } as const;
const FILL = {
  sky: "bg-sky border-sky",
  grape: "bg-grape border-grape",
  mint: "bg-mint border-mint",
} as const;

/** Ticking pops the box and fires a light haptic. */
export function Checkbox({ checked, onChange, size = "md", tone = "sky", label }: CheckboxProps) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dimension = size === "lg" ? "h-9 w-9" : "h-7 w-7";
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      className="h-12 w-12 items-center justify-center"
      onPress={() => {
        if (!checked) {
          scale.value = withSequence(
            withSpring(1.3, { damping: 6 }),
            withSpring(1, { damping: 8 }),
          );
          haptic.success();
        } else haptic.tap();
        onChange(!checked);
      }}
    >
      <Animated.View
        style={style}
        className={`${dimension} items-center justify-center rounded-full border-2 ${checked ? FILL[tone] : RING[tone]}`}
      >
        {checked ? (
          <Icon name="check-bold" size={size === "lg" ? 20 : 16} color="onAccent" />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
