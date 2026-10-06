import { addMonths } from "@tick-taka/shared/dates";
import { View } from "react-native";
import { IconButton } from "./icon-button";

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
      <IconButton
        icon="chevron-left"
        label="Previous month"
        onPress={() => onChange(addMonths(month, -1))}
      />
      <IconButton
        icon="chevron-right"
        label="Next month"
        onPress={() => onChange(addMonths(month, 1))}
      />
    </View>
  );
}
