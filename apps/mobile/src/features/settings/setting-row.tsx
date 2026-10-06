import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

/** A labelled row of chips: single-choice rows are a radio group for screen readers. */
export function ChoiceRow({
  label,
  choice = "single",
  children,
}: {
  label: string;
  choice?: "single" | "multi";
  children: ReactNode;
}) {
  return (
    <View className="gap-2 py-1">
      <Text>{label}</Text>
      <View
        accessibilityRole={choice === "single" ? "radiogroup" : undefined}
        accessibilityLabel={label}
        className="flex-row flex-wrap gap-2"
      >
        {children}
      </View>
    </View>
  );
}
