/**
 * Calculator keypad: evaluates `+ - * / ( )` expressions typed into an amount field,
 * e.g. `1850/3` → 616.666…. Never uses eval; a small recursive-descent parser instead.
 */

type Token = { type: "number"; value: number } | { type: "op"; value: string };

const OPERATORS = new Set(["+", "-", "*", "/", "(", ")"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const source = input.replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/,/g, "");
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

/** True when the text looks like an amount expression (digits with at least one operator allowed). */
export function isAmountExpression(input: string): boolean {
  return /^[\d.,\s]+([+\-*/×÷][\d.,\s]+)*$/.test(input.trim()) && /\d/.test(input);
}
