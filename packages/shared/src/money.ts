/**
 * Money is always stored as an integer count of the smallest unit
 * (poisha for BDT, cents for EUR). These helpers convert at the edges only.
 */

export const DEFAULT_CURRENCY = "BDT";

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

const SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
};

export function minorDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function minorFactor(currency: string): number {
  return 10 ** minorDigits(currency);
}

/** Converts a major-unit number (e.g. 616.67 taka) to minor units, rounding half away from zero. */
export function toMinor(major: number, currency: string = DEFAULT_CURRENCY): number {
  const factor = minorFactor(currency);
  const scaled = major * factor;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON);
  return rounded === 0 ? 0 : rounded;
}

export function toMajor(minor: number, currency: string = DEFAULT_CURRENCY): number {
  return minor / minorFactor(currency);
}

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export interface FormatAmountOptions {
  currency?: string;
  /** Show a leading + for positive values. */
  signed?: boolean;
  /** Always print the fractional part, even when it is zero. */
  forceDecimals?: boolean;
}

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formats minor units for display: `formatAmount(64000) === "৳640"`,
 * `formatAmount(61667) === "৳616.67"`. The fraction is dropped when it is zero.
 */
export function formatAmount(minor: number, options: FormatAmountOptions = {}): string {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const digits = minorDigits(currency);
  const factor = 10 ** digits;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / factor);
  const fraction = abs % factor;
  const showFraction = digits > 0 && (fraction !== 0 || options.forceDecimals === true);
  const body =
    groupThousands(String(whole)) +
    (showFraction ? `.${String(fraction).padStart(digits, "0")}` : "");
  const sign = minor < 0 ? "−" : options.signed && minor > 0 ? "+" : "";
  return `${sign}${currencySymbol(currency)}${body}`;
}

/** Parses a user-typed amount like "1,250.50" into minor units. Returns null when invalid. */
export function parseAmountToMinor(
  input: string,
  currency: string = DEFAULT_CURRENCY,
): number | null {
  const cleaned = input.replace(/[,\s৳]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return toMinor(Number(cleaned), currency);
}

/** Splits a total into `parts` integer shares that sum exactly to the total. */
export function splitEvenly(totalMinor: number, parts: number): number[] {
  if (parts <= 0 || !Number.isInteger(parts)) throw new Error("parts must be a positive integer");
  const base = Math.trunc(totalMinor / parts);
  let remainder = totalMinor - base * parts;
  return Array.from({ length: parts }, () => {
    if (remainder === 0) return base;
    const step = Math.sign(remainder);
    remainder -= step;
    return base + step;
  });
}
