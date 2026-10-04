import { View } from "react-native";

const FILLS = {
  sky: "bg-sky",
  mint: "bg-mint",
  coral: "bg-coral",
  grape: "bg-grape",
  mango: "bg-mango",
} as const;

export function ProgressBar({
  value,
  tone = "mint",
  className,
}: {
  value: number;
  tone?: keyof typeof FILLS;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      className={`h-2.5 overflow-hidden rounded-full bg-line ${className ?? ""}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View className={`h-full rounded-full ${FILLS[tone]}`} style={{ width: `${pct}%` }} />
    </View>
  );
}
