import { ActivityIndicator, Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

const VARIANTS = {
  primary: { box: "bg-mango", text: "ink" as const },
  time: { box: "bg-sky", text: "inverse" as const },
  money: { box: "bg-mint", text: "inverse" as const },
  secondary: { box: "bg-card border border-line", text: "ink" as const },
  ghost: { box: "bg-transparent", text: "ink" as const },
};

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: "md" | "sm";
  className?: string;
}

/** Tap targets stay at least 48 dp tall. */
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
  const style = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      className={`${style.box} ${size === "md" ? "min-h-12 px-5" : "min-h-12 px-3"} flex-row items-center justify-center rounded-2xl active:opacity-80 ${disabled ? "opacity-40" : ""} ${className ?? ""}`}
    >
      {loading ? (
        <ActivityIndicator color={style.text === "inverse" ? "#fff" : undefined} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? (
            <Icon name={icon} size={20} color={style.text === "inverse" ? "white" : "ink"} />
          ) : null}
          <Text variant="strong" tone={style.text} className={size === "sm" ? "text-sm" : ""}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
