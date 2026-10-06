import { describe, expect, test } from "bun:test";
import {
  evaluateExpression,
  expressionToMinor,
  hasOperator,
  isAmountExpression,
  tryEvaluateExpression,
} from "../src/calculator";

describe("calculator keypad", () => {
  test("evaluates with precedence and parentheses", () => {
    expect(evaluateExpression("1850/3")).toBeCloseTo(616.6667);
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("(2+3)*4")).toBe(20);
    expect(evaluateExpression("-5+10")).toBe(5);
    expect(evaluateExpression("1,200 + 300")).toBe(1500);
    expect(evaluateExpression("100×2÷4")).toBe(50);
    expect(evaluateExpression("500−120")).toBe(380);
    expect(evaluateExpression("১৮৫০/৩")).toBeCloseTo(616.6667);
    expect(evaluateExpression("২০০ + ৫০")).toBe(250);
  });

  test("rejects invalid input instead of guessing", () => {
    expect(tryEvaluateExpression("2/0")).toBeNull();
    expect(tryEvaluateExpression("2+")).toBeNull();
    expect(tryEvaluateExpression("alert(1)")).toBeNull();
    expect(tryEvaluateExpression("(1+2")).toBeNull();
  });

  test("detects amount expressions", () => {
    expect(isAmountExpression("250")).toBe(true);
    expect(isAmountExpression("1850/3")).toBe(true);
    expect(isAmountExpression("5pm")).toBe(false);
    expect(isAmountExpression("2h")).toBe(false);
    expect(isAmountExpression("২৫০")).toBe(true);
    expect(isAmountExpression("১৮৫০/৩")).toBe(true);
    expect(isAmountExpression("২h")).toBe(false);
    expect(isAmountExpression("500−120")).toBe(true);
  });

  test("detects operators after the first character", () => {
    expect(hasOperator("1850/3")).toBe(true);
    expect(hasOperator("100×2")).toBe(true);
    expect(hasOperator("500−120")).toBe(true);
    expect(hasOperator("1850/")).toBe(true);
    expect(hasOperator("-50")).toBe(false);
    expect(hasOperator("250")).toBe(false);
  });
});

// Spec: "I type 1850/3 in the amount field and it saves ৳617" (QA-010).
describe("expressionToMinor", () => {
  test.each([
    ["1850/3", "BDT", 61_700],
    ["1850 / 3", "BDT", 61_700],
    ["1850÷3", "BDT", 61_700],
    ["1000/3", "BDT", 33_300],
    ["1000/6", "BDT", 16_700],
    ["100/8", "BDT", 1_250],
    ["10/4", "BDT", 250],
    ["12.50+3.25", "BDT", 1_575],
    ["0.1+0.2", "BDT", 30],
    ["250", "BDT", 25_000],
    ["99.99", "BDT", 9_999],
    ["616.666", "BDT", 61_667],
    ["-1850/3", "BDT", -61_700],
    ["1850/3", "USD", 61_700],
    ["1000/3", "JPY", 333],
    ["১৮৫০/৩", "BDT", 61_700],
  ] as const)("%s in %s → %d", (input, currency, expected) => {
    expect(expressionToMinor(input, currency)).toBe(expected);
  });

  test("defaults to BDT and returns null for invalid input", () => {
    expect(expressionToMinor("1850/3")).toBe(61_700);
    expect(expressionToMinor("2/0")).toBeNull();
    expect(expressionToMinor("1850/")).toBeNull();
    expect(expressionToMinor("")).toBeNull();
  });
});
