import { Pressable } from "react-native";
import { haptic } from "@/lib/haptics";
import { Text } from "./text";

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Kept for call sites; selection is shown the same way everywhere (restrained colour). */
  tone?: "mango" | "sky" | "mint" | "coral" | "grape";
  onPress?: () => void;
  className?: string;
}

/** Neutral pill; selected = ink fill with background-coloured text, readable in both themes. */
export function Chip({ label, selected, onPress, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={4}
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      className={`min-h-10 justify-center rounded-full border px-4 ${selected ? "border-ink bg-ink" : "border-line bg-card"} ${className ?? ""}`}
    >
      <Text variant="callout" className="font-nunito-bold" tone={selected ? "background" : "ink"}>
        {label}
      </Text>
    </Pressable>
  );
}
