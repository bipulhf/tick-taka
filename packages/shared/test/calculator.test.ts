import { describe, expect, test } from "bun:test";
import { evaluateExpression, isAmountExpression, tryEvaluateExpression } from "../src/calculator";

describe("calculator keypad", () => {
  test("evaluates with precedence and parentheses", () => {
    expect(evaluateExpression("1850/3")).toBeCloseTo(616.6667);
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("(2+3)*4")).toBe(20);
    expect(evaluateExpression("-5+10")).toBe(5);
    expect(evaluateExpression("1,200 + 300")).toBe(1500);
    expect(evaluateExpression("100×2÷4")).toBe(50);
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
  });
});
