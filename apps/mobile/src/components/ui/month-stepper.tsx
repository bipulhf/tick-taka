import { addMonths } from "@tick-taka/shared/dates";
import { Pressable, View } from "react-native";
import { Icon } from "./icon";

/** Previous / next month arrows for a screen header; `month` is "YYYY-MM". */
export function MonthStepper({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <View className="flex-row">
      <Pressable
        accessibilityRole="button"
        className="h-12 w-12 items-center justify-center"
        onPress={() => onChange(addMonths(month, -1))}
        accessibilityLabel="Previous month"
      >
        <Icon name="chevron-left" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className="h-12 w-12 items-center justify-center"
        onPress={() => onChange(addMonths(month, 1))}
        accessibilityLabel="Next month"
      >
        <Icon name="chevron-right" />
      </Pressable>
    </View>
  );
}
