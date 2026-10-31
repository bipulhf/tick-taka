import {
  localParts,
  parseLocalDate,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { toMajor } from "@tick-taka/shared/money";
import type { AssistantQuestionField } from "@tick-taka/shared/schemas/ai";
import type { AssistantAnswerValue } from "@tick-taka/shared/tiki-answers";
import { useRef } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { AmountKeypad } from "@/components/ui/amount-keypad";
import { Chip } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Icon } from "@/components/ui/icon";
import { PickerField } from "@/components/ui/picker-field";
import type { PickerOption } from "@/components/ui/picker-options";
import { clockLabel } from "@/components/ui/picker-options";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatAmount, formatLocalDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { pickDate, pickTime } from "@/lib/pick-date";
import { useAccounts, useAreas, useCategories } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import type { FieldScroll } from "./use-chat-scroll";

type Field<T extends AssistantQuestionField["type"]> = Extract<AssistantQuestionField, { type: T }>;

interface FieldProps<F> {
  field: F;
  value: AssistantAnswerValue;
  onChange: (value: AssistantAnswerValue) => void;
}

const asText = (value: AssistantAnswerValue) =>
  typeof value === "string" && value !== "" ? value : null;
const pad = (n: number) => String(n).padStart(2, "0");

/** One pick of a few, as chips; an optional one can be tapped again to clear it. */
function ChoiceInput({ field, value, onChange }: FieldProps<Field<"choice">>) {
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {field.label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={field.label}
        className="flex-row flex-wrap gap-2"
      >
        {field.options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            choice="single"
            selected={value === option.value}
            onPress={() =>
              onChange(value === option.value && !field.required ? null : option.value)
            }
          />
        ))}
      </View>
    </View>
  );
}

/**
 * An amount as a field shaped like the date and picker fields, opening the app's
 * calculator keypad under it (the keypad shows the user's digits). An empty keypad
 * is "not answered", unless Tiki's default was 0 (an opening balance), where 0 is
 * the answer.
 */
function AmountInput({
  field,
  value,
  onChange,
  currency,
  open,
  onToggle,
}: FieldProps<Field<"amount">> & { currency?: string; open: boolean; onToggle: () => void }) {
  const minor = typeof value === "number" ? value : null;
  const shown = minor === null ? null : formatAmount(minor, { currency });
  const placeholder = field.placeholder ?? (field.required ? "Type an amount" : "Optional");
  const zeroCounts = field.default === 0;
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${field.label}: ${shown ?? placeholder}`}
        accessibilityHint={open ? "Closes the keypad" : "Opens the keypad"}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          Keyboard.dismiss();
          haptic.select();
          onToggle();
        }}
        className="min-h-14 justify-center rounded-2xl border border-line-strong bg-card px-4 py-2 active:bg-line/40"
      >
        <Text variant="caption" tone="muted">
          {field.label}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text
            variant="strong"
            numeric
            numberOfLines={1}
            tone={shown ? "ink" : "muted"}
            className="flex-1"
          >
            {shown ?? placeholder}
          </Text>
          <Icon name={open ? "chevron-up" : "calculator-variant-outline"} size={20} color="muted" />
        </View>
      </Pressable>
      {open ? (
        <View className="rounded-2xl bg-background p-2">
          <AmountKeypad
            initial={minor ? String(toMajor(minor, currency)) : ""}
            currency={currency}
            onChange={(next) => onChange(next ?? (zeroCounts ? 0 : null))}
          />
        </View>
      ) : null}
    </View>
  );
}

function DateInput({ field, value, onChange }: FieldProps<Field<"date">>) {
  const { timeZone } = useUserTime();
  const date = asText(value);
  return (
    <DateField
      label={field.label}
      value={date ? formatLocalDate(date) : null}
      placeholder={field.placeholder ?? (field.required ? "Pick a date" : "Optional")}
      onPress={async () => {
        const picked = await pickDate(
          date ? startOfLocalDay(date, timeZone) : Date.now(),
          timeZone,
        );
        if (picked) onChange(picked);
      }}
      onClear={field.required ? undefined : () => onChange(null)}
      clearLabel={`Clear ${field.label}`}
    />
  );
}

/** A time of day (HH:MM), picked with the app's time dialog. */
function TimeInput({ field, value, onChange }: FieldProps<Field<"time">>) {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const time = asText(value);
  return (
    <DateField
      label={field.label}
      kind="time"
      value={time ? clockLabel(time) : null}
      placeholder={field.placeholder ?? (field.required ? "Pick a time" : "Optional")}
      onPress={async () => {
        const [hour = 0, minute = 0] = (time ?? "").split(":").map(Number);
        const initial = time
          ? zonedTimeToUtc({ ...parseLocalDate(today), hour, minute }, timeZone)
          : Date.now();
        const at = await pickTime(today, initial, timeZone);
        if (at === null) return;
        const parts = localParts(at, timeZone);
        onChange(`${pad(parts.hour)}:${pad(parts.minute)}`);
      }}
      onClear={field.required ? undefined : () => onChange(null)}
      clearLabel={`Clear ${field.label}`}
    />
  );
}

/** One of the user's accounts, categories or areas, in the app's picker field. */
function RecordInput({
  field,
  value,
  onChange,
}: FieldProps<Field<"account"> | Field<"category"> | Field<"area">>) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  // A category field may be narrowed to expense or income categories.
  const kind = field.type === "category" ? field.options?.[0]?.value : undefined;
  const options: PickerOption[] =
    field.type === "account"
      ? accounts.map((a) => ({ id: a.id, label: a.name }))
      : field.type === "category"
        ? categories
            .filter((c) => !kind || c.kind === kind)
            .map((c) => ({ id: c.id, label: c.name, emoji: c.emoji }))
        : areas.map((a) => ({ id: a.id, label: a.name, emoji: a.emoji }));
  return (
    <PickerField
      label={field.label}
      value={asText(value)}
      options={options}
      onChange={(id) => onChange(id)}
      placeholder={field.placeholder ?? "Choose"}
      noneLabel={field.required ? undefined : "None"}
      describe={() => "Chosen by Tiki"}
    />
  );
}

/**
 * One field of Tiki's form with the app's own input for its type. Touching it keeps
 * it in view while a list or the keypad opens under it; a text field is moved up
 * above the keyboard.
 */
export function QuestionField({
  field,
  value,
  onChange,
  currency,
  keypad,
  onKeypad,
  scroll,
}: FieldProps<AssistantQuestionField> & {
  currency?: string;
  /** The key of the amount field whose keypad is open; one at a time. */
  keypad: string | null;
  onKeypad: (key: string | null) => void;
  scroll: FieldScroll;
}) {
  const box = useRef<View>(null);
  const keypadOpen = keypad === field.key;
  const input = (() => {
    switch (field.type) {
      case "choice":
        return <ChoiceInput field={field} value={value} onChange={onChange} />;
      case "text":
        return (
          <TextField
            label={field.label}
            value={asText(value) ?? ""}
            onChangeText={onChange}
            placeholder={field.placeholder ?? (field.required ? undefined : "Optional")}
            maxLength={80}
            returnKeyType="done"
            onFocus={() => {
              onKeypad(null);
              scroll.reveal(box.current);
            }}
          />
        );
      case "amount":
        return (
          <AmountInput
            field={field}
            value={value}
            onChange={onChange}
            currency={currency}
            open={keypadOpen}
            onToggle={() => onKeypad(keypadOpen ? null : field.key)}
          />
        );
      case "date":
        return <DateInput field={field} value={value} onChange={onChange} />;
      case "time":
        return <TimeInput field={field} value={value} onChange={onChange} />;
      default:
        return <RecordInput field={field} value={value} onChange={onChange} />;
    }
  })();
  return (
    <View ref={box} onTouchStart={() => scroll.hold(box.current)}>
      {input}
    </View>
  );
}
