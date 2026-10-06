import { expressionToMinor, hasOperator } from "@tick-taka/shared/calculator";
import { toBanglaDigits } from "@tick-taka/shared/digits";
import { currencySymbol } from "@tick-taka/shared/money";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { formatAmount, numeralsStore } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useStore } from "@/lib/store";
import { Text } from "./text";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", ".", "0", "⌫", "+"];

export interface AmountKeypadProps {
  /** Starting expression, e.g. "250" */
  initial?: string;
  currency?: string;
  onChange: (minor: number | null, expression: string) => void;
  tone?: "coral" | "mint" | "ink";
}

/** Calculator keypad: typing 1850/3 saves ৳617 (an uneven split rounds to whole taka). */
export function AmountKeypad({
  initial = "",
  currency = "BDT",
  onChange,
  tone = "ink",
}: AmountKeypadProps) {
  const [expression, setExpression] = useState(initial);
  const minor = expressionToMinor(expression, currency);
  // The expression stays in 0-9; only what is shown follows Settings › Numbers.
  const bangla = useStore(numeralsStore) === "beng";
  const shown = (text: string) => (bangla ? toBanglaDigits(text) : text);

  const press = (key: string) => {
    haptic.select();
    let next = expression;
    if (key === "⌫") next = expression.slice(0, -1);
    else if ("÷×−+".includes(key))
      next = /[÷×−+]$/.test(expression)
        ? `${expression.slice(0, -1)}${key}`
        : expression
          ? `${expression}${key}`
          : expression;
    else if (key === "." && /\.\d*$/.test(expression.split(/[÷×−+]/).at(-1) ?? ""))
      next = expression;
    else next = `${expression}${key}`;
    setExpression(next);
    const result = expressionToMinor(next, currency);
    onChange(result !== null && result > 0 ? result : null, next);
  };

  return (
    <View className="gap-2">
      <View className="items-end rounded-2xl bg-card px-4 py-3">
        <Text variant="display" tone={tone} numeric numberOfLines={1} adjustsFontSizeToFit>
          {currencySymbol(currency)}
          {shown(expression || "0")}
        </Text>
        {hasOperator(expression) && minor !== null ? (
          <Text tone="muted" numeric>
            = {formatAmount(minor, { currency })}
          </Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => press(key)}
            onLongPress={key === "⌫" ? () => press("⌫") : undefined}
            accessibilityRole="keyboardkey"
            accessibilityLabel={key === "⌫" ? "Delete" : key}
            className={`min-h-14 w-[23.5%] items-center justify-center rounded-2xl active:opacity-60 ${"÷×−+".includes(key) ? "bg-mango/30" : "bg-card"}`}
          >
            <Text variant="title" maxFontSizeMultiplier={1.3}>
              {shown(key)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
