import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Icon } from "./icon";
import { Text } from "./text";

export interface PickerOption {
  id: string;
  label: string;
  emoji?: string;
}

/**
 * - field: a sheet field, caption label over the value ("Account / Cash ▾").
 * - filter: one compact line above a list ("Type: All ▾").
 */
export type PickerFieldVariant = "field" | "filter";

/** full takes the row's width; half shares a row with one other picker. */
export type PickerFieldSpan = "full" | "half";

/** list: one option per row; grid: emoji-only options in a wrapping grid of 48 dp circles. */
export type PickerFieldLayout = "list" | "grid";

const BOX: Record<PickerFieldVariant, string> = {
  field: "rounded-2xl",
  filter: "rounded-3xl",
};

const SPAN: Record<PickerFieldSpan, string> = {
  full: "self-stretch",
  half: "flex-1",
};

/** The id onChange receives for the "none" option. */
const NONE = "";

/**
 * Compact "Cash ▾" field that opens into a short list in place, instead of a row
 * of chips. Tapping an option picks it and closes the list. With `noneLabel`, the
 * list starts with an option that clears the choice (onChange gets null).
 */
export function PickerField({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose",
  noneLabel,
  variant = "field",
  span = "full",
  layout = "list",
}: {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (id: string | null) => void;
  placeholder?: string;
  noneLabel?: string;
  variant?: PickerFieldVariant;
  span?: PickerFieldSpan;
  layout?: PickerFieldLayout;
}) {
  const [open, setOpen] = useState(false);
  const all = noneLabel ? [{ id: NONE, label: noneLabel }, ...options] : options;
  const selected = value ?? (noneLabel ? NONE : null);
  const current = all.find((o) => o.id === selected);
  const shown = current
    ? `${current.emoji ? `${current.emoji} ` : ""}${current.label}`
    : placeholder;
  return (
    <View
      className={`overflow-hidden border border-line-strong bg-card ${BOX[variant]} ${SPAN[span]}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic.select();
          setOpen(!open);
        }}
        className={
          variant === "field"
            ? "min-h-14 justify-center px-4 py-2 active:bg-line/40"
            : "min-h-12 flex-row items-center gap-1 px-4 active:bg-line/40"
        }
      >
        {variant === "field" ? (
          <>
            <Text variant="caption" tone="muted">
              {label}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text variant="strong" numberOfLines={1} className="flex-1">
                {shown}
              </Text>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color="muted" />
            </View>
          </>
        ) : (
          <>
            <Text variant="callout" numberOfLines={1} className="flex-1">
              <Text variant="callout" tone="muted">
                {`${label}: `}
              </Text>
              <Text variant="callout" className="font-nunito-bold">
                {shown}
              </Text>
            </Text>
            <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color="muted" />
          </>
        )}
      </Pressable>
      {open && layout === "grid" ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          className="flex-row flex-wrap gap-2 border-t border-line p-3"
        >
          {all.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.id === selected }}
              accessibilityLabel={option.label}
              onPress={() => {
                haptic.select();
                onChange(option.id === NONE ? null : option.id);
                setOpen(false);
              }}
              className={`h-12 w-12 items-center justify-center rounded-full ${option.id === selected ? "bg-ink" : "bg-background"}`}
            >
              <Text className="text-2xl" maxFontSizeMultiplier={1.3}>
                {option.emoji ?? option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : open ? (
        <ScrollView
          className="max-h-72 border-t border-line"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {all.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: option.id === selected }}
              onPress={() => {
                haptic.select();
                onChange(option.id === NONE ? null : option.id);
                setOpen(false);
              }}
              className="min-h-12 flex-row items-center gap-2 px-4 active:bg-line/40"
            >
              <Text
                className="flex-1"
                numberOfLines={1}
                tone={option.id === NONE ? "muted" : "ink"}
              >
                {option.emoji ? `${option.emoji}  ` : ""}
                {option.label}
              </Text>
              {option.id === selected ? <Icon name="check" size={20} color="ink" /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
