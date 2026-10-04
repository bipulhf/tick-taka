import { tryEvaluateExpression } from "@tick-taka/shared/calculator";
import { currencySymbol, toMinor } from "@tick-taka/shared/money";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Text } from "./text";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", ".", "0", "⌫", "+"];

export interface AmountKeypadProps {
  /** Starting expression, e.g. "250" */
  initial?: string;
  currency?: string;
  onChange: (minor: number | null, expression: string) => void;
  tone?: "coral" | "mint" | "ink";
}

/** Calculator keypad: typing 1850/3 saves ৳617 (rounded to the poisha). */
export function AmountKeypad({
  initial = "",
  currency = "BDT",
  onChange,
  tone = "ink",
}: AmountKeypadProps) {
  const [expression, setExpression] = useState(initial);
  const normalized = expression.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-");
  const value = tryEvaluateExpression(normalized);
  const hasOperator = /[+\-*/]/.test(normalized.slice(1));

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
    const result = tryEvaluateExpression(
      next.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-"),
    );
    onChange(result !== null && result > 0 ? toMinor(result, currency) : null, next);
  };

  return (
    <View className="gap-2">
      <View className="items-end rounded-2xl bg-card px-4 py-3">
        <Text variant="display" tone={tone} numeric numberOfLines={1} adjustsFontSizeToFit>
          {currencySymbol(currency)}
          {expression || "0"}
        </Text>
        {hasOperator && value !== null ? (
          <Text tone="muted" numeric>
            = {currencySymbol(currency)}
            {(Math.round(value * 100) / 100).toLocaleString("en-US")}
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
            className={`h-14 w-[23.5%] items-center justify-center rounded-2xl active:opacity-60 ${"÷×−+".includes(key) ? "bg-mango/30" : "bg-card"}`}
          >
            <Text variant="title">{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
