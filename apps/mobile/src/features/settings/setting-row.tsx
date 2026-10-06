import type { ReactNode } from "react";
import { Switch, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColors } from "@/theme/colors";

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
        trackColor={{ true: colors.mango, false: colors.lineStrong }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2 py-1">
      <Text>{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
