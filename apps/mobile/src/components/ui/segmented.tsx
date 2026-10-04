import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Text } from "./text";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-2xl bg-line/60 p-1">
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => {
            haptic.select();
            onChange(option.value);
          }}
          className={`min-h-11 flex-1 items-center justify-center rounded-xl ${option.value === value ? "bg-card" : ""}`}
        >
          <Text
            variant="caption"
            className="font-nunito-bold"
            tone={option.value === value ? "ink" : "muted"}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
