/**
 * Bangla digits (০-৯, U+09E6-U+09EF) as typed by a Bangla keyboard. Each maps to
 * exactly one ASCII digit, so conversion keeps string length and indexes intact.
 */

const BANGLA_ZERO = 0x09e6;

/** "চা ২০" → "চা 20". Everything that parses a number runs its input through this. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - BANGLA_ZERO));
}

/** "৳1,23,456" → "৳১,২৩,৪৫৬". For display only; never store Bangla digits. */
export function toBanglaDigits(text: string): string {
  return text.replace(/[0-9]/g, (digit) => String.fromCharCode(BANGLA_ZERO + Number(digit)));
}

/**
 * A whole number typed into a count or minutes field ("৩", "12"), or null when the
 * text isn't one. `Number("৩")` is NaN, so typed numbers always go through here.
 */
export function parseTypedInteger(text: string): number | null {
  const plain = toAsciiDigits(text).trim();
  return /^\d+$/.test(plain) ? Number(plain) : null;
}
