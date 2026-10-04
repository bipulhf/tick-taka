import { Pressable } from "react-native";
import { haptic } from "@/lib/haptics";
import { Text } from "./text";

const ACTIVE = {
  mango: "bg-mango border-mango",
  sky: "bg-sky border-sky",
  mint: "bg-mint border-mint",
  coral: "bg-coral border-coral",
  grape: "bg-grape border-grape",
} as const;

export interface ChipProps {
  label: string;
  selected?: boolean;
  tone?: keyof typeof ACTIVE;
  onPress?: () => void;
  className?: string;
}

export function Chip({ label, selected, tone = "mango", onPress, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      className={`min-h-10 justify-center rounded-full border px-4 ${selected ? ACTIVE[tone] : "border-line bg-card"} ${className ?? ""}`}
    >
      <Text
        variant="caption"
        className="font-nunito-bold"
        tone={selected && tone !== "mango" ? "inverse" : "ink"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
