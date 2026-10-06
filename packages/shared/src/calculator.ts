/**
 * Calculator keypad: evaluates `+ - * / ( )` expressions typed into an amount field,
 * e.g. `1850/3` → 616.666…. Never uses eval; a small recursive-descent parser instead.
 */

import { toAsciiDigits } from "./digits";
import { DEFAULT_CURRENCY, minorFactor, toMinor } from "./money";

type Token = { type: "number"; value: number } | { type: "op"; value: string };

const OPERATORS = new Set(["+", "-", "*", "/", "(", ")"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const source = toAsciiDigits(input)
    .replace(/[×x]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/,/g, "");
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (char === " ") {
      index++;
      continue;
    }
    if (OPERATORS.has(char)) {
      tokens.push({ type: "op", value: char });
      index++;
      continue;
    }
    const match = /^\d+(\.\d+)?|^\.\d+/.exec(source.slice(index));
    if (!match) throw new Error(`Unexpected character "${char}"`);
    tokens.push({ type: "number", value: Number(match[0]) });
    index += match[0].length;
  }
  return tokens;
}

class Parser {
  private position = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expression();
    if (this.position !== this.tokens.length) throw new Error("Unexpected trailing input");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private expression(): number {
    let value = this.term();
    for (
      let token = this.peek();
      token?.type === "op" && (token.value === "+" || token.value === "-");
      token = this.peek()
    ) {
      this.position++;
      const right = this.term();
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    for (
      let token = this.peek();
      token?.type === "op" && (token.value === "*" || token.value === "/");
      token = this.peek()
    ) {
      this.position++;
      const right = this.factor();
      if (token.value === "/" && right === 0) throw new Error("Division by zero");
      value = token.value === "*" ? value * right : value / right;
    }
    return value;
  }

  private factor(): number {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");
    this.position++;
    if (token.type === "number") return token.value;
    if (token.value === "-") return -this.factor();
    if (token.value === "+") return this.factor();
    if (token.value === "(") {
      const value = this.expression();
      const closing = this.peek();
      if (closing?.type !== "op" || closing.value !== ")")
        throw new Error("Missing closing parenthesis");
      this.position++;
      return value;
    }
    throw new Error(`Unexpected "${token.value}"`);
  }
}

/** Evaluates an arithmetic expression. Throws on invalid input. */
export function evaluateExpression(input: string): number {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new Error("Empty expression");
  const value = new Parser(tokens).parse();
  if (!Number.isFinite(value)) throw new Error("Result is not a finite number");
  return value;
}

/** Like `evaluateExpression` but returns null instead of throwing. */
export function tryEvaluateExpression(input: string): number | null {
  try {
    return evaluateExpression(input);
  } catch {
    return null;
  }
}

/**
 * True when the text looks like an amount expression (digits with at least one operator
 * allowed). Bangla digits count: "২৫০" and "১৮৫০/৩" are amounts.
 */
export function isAmountExpression(input: string): boolean {
  const text = toAsciiDigits(input).trim();
  return /^[\d.,\s]+([+\-*/×÷−][\d.,\s]+)*$/.test(text) && /\d/.test(text);
}

/** True when an operator follows the first character, e.g. "1850/3" but not "-50". */
export function hasOperator(input: string): boolean {
  return /[+\-*/×÷−]/.test(input.trim().slice(1));
}

/**
 * Minor units for a typed amount or expression, or null when it does not evaluate.
 * An expression whose result does not fit the currency's minor unit is rounded to
 * the whole major unit: splitting a bill as `1850/3` saves ৳617, not ৳616.67.
 * Exact results (`12.50+3.25`) and plain typed amounts keep their poisha.
 */
export function expressionToMinor(
  input: string,
  currency: string = DEFAULT_CURRENCY,
): number | null {
  const value = tryEvaluateExpression(input);
  if (value === null) return null;
  const scaled = value * minorFactor(currency);
  const fitsMinorUnit = Math.abs(scaled - Math.round(scaled)) < 1e-6;
  if (fitsMinorUnit || !hasOperator(input)) return toMinor(value, currency);
  return toMinor(Math.sign(value) * Math.round(Math.abs(value)), currency);
}
