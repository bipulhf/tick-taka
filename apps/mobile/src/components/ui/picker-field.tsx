import { useState } from "react";
import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon } from "./icon";
import { Text } from "./text";

export interface PickerOption {
  id: string;
  label: string;
  emoji?: string;
}

/**
 * Compact "Cash ▾" field that opens into a short list in place, instead of a row
 * of chips. Tapping an option picks it and closes the list.
 */
export function PickerField({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose",
}: {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-line-strong bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic.select();
          setOpen(!open);
        }}
        className="min-h-14 justify-center px-4 py-2 active:bg-line/40"
      >
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text variant="strong" numberOfLines={1} className="flex-1">
            {current ? `${current.emoji ? `${current.emoji} ` : ""}${current.label}` : placeholder}
          </Text>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color="muted" />
        </View>
      </Pressable>
      {open ? (
        <View className="max-h-72 border-t border-line">
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: option.id === value }}
              onPress={() => {
                haptic.select();
                onChange(option.id);
                setOpen(false);
              }}
              className="min-h-12 flex-row items-center gap-2 px-4 active:bg-line/40"
            >
              <Text className="flex-1" numberOfLines={1}>
                {option.emoji ? `${option.emoji}  ` : ""}
                {option.label}
              </Text>
              {option.id === value ? <Icon name="check" size={20} color="ink" /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
