import { describe, expect, test } from "bun:test";
import {
  CURRENCY_WORD_RE,
  currencySymbol,
  DEFAULT_CURRENCY,
  defaultGrouping,
  formatAmount,
  groupDigits,
  minorDigits,
  minorFactor,
  parseAmountToMinor,
  splitEvenly,
  stripCurrency,
  toMajor,
  toMinor,
} from "../src/money";

describe("money", () => {
  test("converts to and from minor units", () => {
    expect(toMinor(250)).toBe(25_000);
    expect(toMinor(616.666)).toBe(61_667);
    expect(toMinor(-0.005)).toBe(-1);
    expect(toMinor(1000, "JPY")).toBe(1000);
    expect(toMajor(61_667)).toBeCloseTo(616.67);
  });

  test("formats with the taka sign and drops zero fractions", () => {
    expect(formatAmount(64_000)).toBe("৳640");
    expect(formatAmount(4_500_000)).toBe("৳45,000");
    expect(formatAmount(61_667)).toBe("৳616.67");
    expect(formatAmount(-25_000)).toBe("−৳250");
    expect(formatAmount(25_000, { signed: true })).toBe("+৳250");
    expect(formatAmount(1050, { currency: "USD" })).toBe("$10.50");
    expect(formatAmount(64_000, { forceDecimals: true })).toBe("৳640.00");
  });

  test("parses typed amounts", () => {
    expect(parseAmountToMinor("1,250.50")).toBe(125_050);
    expect(parseAmountToMinor("৳ 60")).toBe(6_000);
    expect(parseAmountToMinor("abc")).toBeNull();
  });

  test("splits evenly without losing poisha", () => {
    const parts = splitEvenly(185_000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(185_000);
    expect(parts).toEqual([61_667, 61_667, 61_666]);
  });

  test("minor units per currency", () => {
    expect(DEFAULT_CURRENCY).toBe("BDT");
    expect(minorDigits("BDT")).toBe(2);
    expect(minorDigits("jpy")).toBe(0);
    expect(minorFactor("USD")).toBe(100);
    expect(minorFactor("KRW")).toBe(1);
    expect(toMajor(1000, "JPY")).toBe(1000);
    expect(toMinor(0)).toBe(0);
    expect(Object.is(toMinor(-0.001), 0)).toBe(true);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  test("currency symbols fall back to the code", () => {
    expect(currencySymbol("bdt")).toBe("৳");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("chf")).toBe("CHF ");
    expect(formatAmount(1050, { currency: "CHF" })).toBe("CHF 10.50");
    expect(formatAmount(1500, { currency: "JPY", forceDecimals: true })).toBe("¥1,500");
  });

  test("parses negatives and rejects junk", () => {
    expect(parseAmountToMinor("-60")).toBe(-6_000);
    expect(parseAmountToMinor("0.5")).toBe(50);
    expect(parseAmountToMinor("1500", "JPY")).toBe(1500);
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("12.")).toBeNull();
    expect(parseAmountToMinor("1e3")).toBeNull();
  });

  test("splitEvenly handles negatives and rejects bad part counts", () => {
    expect(splitEvenly(-100, 3)).toEqual([-34, -33, -33]);
    expect(splitEvenly(100, 1)).toEqual([100]);
    expect(() => splitEvenly(100, 0)).toThrow("parts must be a positive integer");
    expect(() => splitEvenly(100, 1.5)).toThrow("parts must be a positive integer");
  });

  test("parses Bangla digits and currency words (QA-011)", () => {
    expect(parseAmountToMinor("২৫০")).toBe(25_000);
    expect(parseAmountToMinor("১,২৫০.৫০")).toBe(125_050);
    expect(parseAmountToMinor("৳২০")).toBe(2_000);
    expect(parseAmountToMinor("২০ টাকা")).toBe(2_000);
    expect(parseAmountToMinor("২০টাকা")).toBe(2_000);
    expect(parseAmountToMinor("Tk 500")).toBe(50_000);
    expect(parseAmountToMinor("500 tk.")).toBe(50_000);
    expect(parseAmountToMinor("60 taka")).toBe(6_000);
    expect(parseAmountToMinor("টাকা")).toBeNull();
    expect(parseAmountToMinor("২৫০ apples")).toBeNull();
  });

  test("stripCurrency and CURRENCY_WORD_RE", () => {
    expect(stripCurrency(" ৳২৫০ ")).toBe("250");
    expect(stripCurrency("৬০tk")).toBe("60");
    expect(stripCurrency("lunch")).toBe("lunch");
    expect(CURRENCY_WORD_RE.test("টাকা")).toBe(true);
    expect(CURRENCY_WORD_RE.test("TK")).toBe(true);
    expect(CURRENCY_WORD_RE.test("৳")).toBe(true);
    expect(CURRENCY_WORD_RE.test("tea")).toBe(false);
  });

  // UX-021: Bangladeshi convention is lakh grouping, "৳2,72,490" not "৳272,490".
  test("groups taka in lakh and crore", () => {
    expect(formatAmount(1_000)).toBe("৳10");
    expect(formatAmount(99_999_00)).toBe("৳99,999");
    expect(formatAmount(100_000_00)).toBe("৳1,00,000");
    expect(formatAmount(27_249_000)).toBe("৳2,72,490");
    expect(formatAmount(27_249_050)).toBe("৳2,72,490.50");
    expect(formatAmount(1_234_567_800)).toBe("৳1,23,45,678");
    expect(formatAmount(-100_000_00)).toBe("−৳1,00,000");
    expect(formatAmount(100_000_00, { signed: true })).toBe("+৳1,00,000");
  });

  test("other currencies keep thousands unless asked", () => {
    expect(formatAmount(12_345_678, { currency: "USD" })).toBe("$123,456.78");
    expect(formatAmount(12_345_678, { currency: "INR" })).toBe("₹1,23,456.78");
    expect(formatAmount(27_249_000, { grouping: "intl" })).toBe("৳272,490");
    expect(formatAmount(12_345_678, { currency: "EUR", grouping: "lakh" })).toBe("€1,23,456.78");
    expect(defaultGrouping("bdt")).toBe("lakh");
    expect(defaultGrouping("INR")).toBe("lakh");
    expect(defaultGrouping("EUR")).toBe("intl");
  });

  test("prints Bangla digits on request", () => {
    expect(formatAmount(27_249_050, { numerals: "beng" })).toBe("৳২,৭২,৪৯০.৫০");
    expect(formatAmount(-64_000, { numerals: "beng" })).toBe("−৳৬৪০");
    expect(formatAmount(64_000, { numerals: "latn" })).toBe("৳640");
    expect(parseAmountToMinor(formatAmount(27_249_050, { numerals: "beng" }))).toBe(27_249_050);
  });

  test.each([
    ["", "lakh", ""],
    ["7", "lakh", "7"],
    ["999", "lakh", "999"],
    ["1000", "lakh", "1,000"],
    ["12345", "lakh", "12,345"],
    ["123456", "lakh", "1,23,456"],
    ["1234567", "lakh", "12,34,567"],
    ["123456789", "lakh", "12,34,56,789"],
    ["123456", "intl", "123,456"],
    ["1234567", "intl", "1,234,567"],
  ] as const)("groupDigits(%s, %s) → %s", (digits, grouping, expected) => {
    expect(groupDigits(digits, grouping)).toBe(expected);
  });
});
