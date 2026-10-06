import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { Text } from "./text";

/** date opens the date dialog; time opens the date-and-time dialogs. */
export type DateFieldKind = "date" | "time";

/** full takes the row's width; half shares a row with one other field. */
export type DateFieldSpan = "full" | "half";

const ICON = { date: "calendar-blank-outline", time: "clock-outline" } as const;

const SPAN: Record<DateFieldSpan, string> = {
  full: "self-stretch",
  half: "flex-1",
};

/**
 * A sheet field for a date or time, shaped like PickerField: caption label over
 * the value ("Next due / Mon 5 Oct"). Tapping it opens the system dialog through
 * `onPress`. With `onClear`, a set value gets a remove button named by `clearLabel`.
 */
export function DateField({
  label,
  value,
  placeholder = "Pick a date",
  onPress,
  onClear,
  clearLabel = "Remove",
  kind = "date",
  span = "full",
}: {
  label: string;
  /** The value as the user reads it, or null when nothing is set. */
  value: string | null;
  placeholder?: string;
  onPress: () => void;
  onClear?: () => void;
  clearLabel?: string;
  kind?: DateFieldKind;
  span?: DateFieldSpan;
}) {
  return (
    <View
      className={`flex-row items-center overflow-hidden rounded-2xl border border-line-strong bg-card ${SPAN[span]}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        onPress={() => {
          haptic.select();
          onPress();
        }}
        className="min-h-14 flex-1 justify-center px-4 py-2 active:bg-line/40"
      >
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text
            variant="strong"
            numberOfLines={1}
            tone={value ? "ink" : "muted"}
            className="flex-1"
          >
            {value ?? placeholder}
          </Text>
          <Icon name={ICON[kind]} size={20} color="muted" />
        </View>
      </Pressable>
      {value && onClear ? (
        <IconButton icon="close" label={clearLabel} color="muted" iconSize={20} onPress={onClear} />
      ) : null}
    </View>
  );
}
