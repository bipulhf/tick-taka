import { expressionToMinor, hasOperator } from "@tick-taka/shared/calculator";
import { stripCurrency, toMajor } from "@tick-taka/shared/money";

/**
 * What an amount field holds, read as minor units: "1,250.50", "৳ 60", "২৫০" and
 * sums like "1850/3" or "120+45" (the phone keypad's calculator). Null when it
 * doesn't read as a number. Pure, so it can be tested.
 */
export function readAmount(text: string, currency = "BDT"): number | null {
  const cleaned = stripCurrency(text);
  if (!cleaned) return null;
  return expressionToMinor(cleaned, currency);
}

/** A positive amount, or null for empty, zero, negative or unreadable text. */
export function readPositiveAmount(text: string, currency = "BDT"): number | null {
  const minor = readAmount(text, currency);
  return minor !== null && minor > 0 ? minor : null;
}

/** Whether the field holds a sum to work out (so it can show the result). */
export function isSum(text: string): boolean {
  return hasOperator(stripCurrency(text));
}

/** The text an amount field starts with for a stored amount; empty for zero. */
export function amountText(minor: number | null | undefined, currency = "BDT"): string {
  return minor ? String(toMajor(minor, currency)) : "";
}
