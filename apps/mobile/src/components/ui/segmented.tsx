import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { choiceA11y } from "./a11y-actions";
import { Text } from "./text";

/**
 * - choice: picks a value (Light / Dark, Expense / Income); a radio group.
 * - tabs: switches what the screen below shows (Today / Upcoming); a tab list.
 */
export type SegmentedKind = "choice" | "tabs";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  kind = "choice",
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  kind?: SegmentedKind;
  /** What the group chooses, for screen readers ("Theme"). */
  label?: string;
}) {
  const tabs = kind === "tabs";
  return (
    <View
      accessibilityRole={tabs ? "tablist" : "radiogroup"}
      accessibilityLabel={label}
      className="flex-row rounded-2xl bg-line/60 p-1"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            {...choiceA11y(tabs ? "tab" : "single", on)}
            onPress={() => {
              haptic.select();
              onChange(option.value);
            }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl ${on ? "bg-card" : ""}`}
          >
            <Text variant="caption" className="font-nunito-bold" tone={on ? "ink" : "muted"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
