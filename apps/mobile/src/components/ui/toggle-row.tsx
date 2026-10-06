import { Switch, View } from "react-native";
import { useColors } from "@/theme/colors";
import { Text } from "./text";

/** An on/off setting: its name (and an optional hint) beside a switch. */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View className="min-h-12 flex-row items-center gap-3">
      <View className="flex-1">
        <Text>{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        // On reads like a selected chip (ink, with a background-coloured thumb); mango is
        // kept for the one primary action on the screen.
        trackColor={{ true: colors.ink, false: colors.lineStrong }}
        thumbColor={value ? colors.background : undefined}
        accessibilityLabel={label}
      />
    </View>
  );
}
