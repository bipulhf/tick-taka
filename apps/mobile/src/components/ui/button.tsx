import { ActivityIndicator, Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { useColors } from "@/theme/colors";
import { ON_ACCENT } from "@/theme/palette";
import { Icon, type IconName } from "./icon";
import { Text, type TextTone } from "./text";

const VARIANTS: Record<string, { box: string; text: TextTone; icon: "onAccent" | "sky" | "ink" }> =
  {
    primary: { box: "bg-mango", text: "onAccent", icon: "onAccent" },
    /** Time actions: outlined like secondary, marked by a sky icon instead of a large sky fill. */
    time: { box: "bg-card border border-line-strong", text: "ink", icon: "sky" },
    money: { box: "bg-mint", text: "onAccent", icon: "onAccent" },
    secondary: { box: "bg-card border border-line-strong", text: "ink", icon: "ink" },
    ghost: { box: "bg-transparent", text: "ink", icon: "ink" },
  };

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "time" | "money" | "secondary" | "ghost";
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: "md" | "sm";
  className?: string;
}

/** 52 dp tall by default, 44 dp for the small size (still inside a 48 dp hit area). */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  size = "md",
  className,
}: ButtonProps) {
  const style = VARIANTS[variant]!;
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      hitSlop={size === "sm" ? 4 : 0}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      className={`${style.box} ${size === "md" ? "min-h-[52px] px-6" : "min-h-11 px-4"} flex-row items-center justify-center rounded-2xl active:opacity-80 ${disabled ? "opacity-40" : ""} ${className ?? ""}`}
    >
      {loading ? (
        <ActivityIndicator color={style.text === "onAccent" ? ON_ACCENT : colors.ink} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Icon name={icon} size={size === "md" ? 22 : 18} color={style.icon} /> : null}
          <Text
            variant={size === "md" ? "strong" : "callout"}
            tone={style.text}
            className={size === "sm" ? "font-nunito-bold" : ""}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
