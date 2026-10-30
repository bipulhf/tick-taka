import { currencySymbol } from "@tick-taka/shared/money";
import { forwardRef } from "react";
import { TextField, type TextFieldProps } from "@/components/ui/text-field";
import { formatAmount } from "@/lib/format";
import { isSum, readAmount } from "./amount-text";

/**
 * An amount typed as a number or a sum ("1850/3", "120+45"), as on the phone's
 * keypad. A sum shows what it comes to under the field.
 */
export const AmountField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, "value" | "onChange" | "prefix"> & {
    value: string;
    onChange: (text: string) => void;
    currency?: string;
  }
>(function AmountField({ value, onChange, currency = "BDT", hint, error, ...props }, ref) {
  const minor = value && isSum(value) ? readAmount(value, currency) : null;
  return (
    <TextField
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      prefix={currencySymbol(currency).trim()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={minor !== null ? `= ${formatAmount(minor, { currency })}` : hint}
      {...props}
    />
  );
});
