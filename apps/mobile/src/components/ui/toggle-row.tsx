import { Pressable, Switch, View } from "react-native";
import { useColors } from "@/theme/colors";
import { SWITCH_TRACK } from "@/theme/palette";
import { Text } from "./text";

/**
 * The app's one switch style. On reads like a selected chip (ink, with a
 * background-coloured thumb, well over 3:1 on a card); mango is kept for the one
 * primary action on the screen, and mint for money coming in.
 */
function useSwitchColors(value: boolean) {
  const colors = useColors();
  return {
    trackColor: { true: colors[SWITCH_TRACK.on], false: colors[SWITCH_TRACK.off] },
    thumbColor: value ? colors.background : undefined,
  };
}

/**
 * A switch on its own, for a row that already names it (a budget line's rollover).
 * Prefer ToggleRow, where the whole row toggles.
 */
export function Toggle({
  label,
  value,
  onChange,
}: {
  /** What screen readers call it. */
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      {...useSwitchColors(value)}
    />
  );
}

/**
 * An on/off setting: its name (and an optional hint) beside a switch. The whole row
 * is the target and is one switch to a screen reader, read once with its state.
 */
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
  const switchColors = useSwitchColors(value);
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      className="min-h-14 flex-row items-center gap-3 active:opacity-70"
    >
      <View className="flex-1">
        <Text>{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {/* Drawn for its state only: the row takes the tap and speaks for it. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <Switch value={value} {...switchColors} />
      </View>
    </Pressable>
  );
}
