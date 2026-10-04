import { describe, expect, test } from "bun:test";
import { formatAmount, parseAmountToMinor, splitEvenly, toMajor, toMinor } from "../src/money";

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
});
