import { Pressable } from "react-native";
import { haptic } from "@/lib/haptics";
import { choiceA11y } from "./a11y-actions";
import { Text } from "./text";

/**
 * - action: a one-off tap (a suggestion, "No deadline"); a button.
 * - single: one of a row, picked alone; a radio, announced as checked.
 * - multi: one of a row where several can be picked (days off); a checkbox.
 */
export type ChipChoice = "action" | "single" | "multi";

/**
 * `choice` is required so every chip says how a screen reader announces it. An
 * action has no selected state: an on/off setting is a ToggleRow (a switch), not
 * a chip that changes its label.
 */
export type ChipProps = {
  label: string;
  /** Kept for call sites; selection is shown the same way everywhere (restrained colour). */
  tone?: "mango" | "sky" | "mint" | "coral" | "grape";
  onPress?: () => void;
  className?: string;
} & (
  | { choice: "action"; selected?: never }
  | { choice: Exclude<ChipChoice, "action">; selected: boolean }
);

/** Neutral pill; selected = ink fill with background-coloured text, readable in both themes. */
export function Chip({ label, selected, choice, onPress, className }: ChipProps) {
  return (
    <Pressable
      {...choiceA11y(choice, Boolean(selected))}
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
