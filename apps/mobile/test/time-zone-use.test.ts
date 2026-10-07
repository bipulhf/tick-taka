import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dir, "../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * Helpers whose last parameter is a time zone that falls back to the app's default
 * (Asia/Dhaka), with the number of arguments a call needs to pass the zone.
 */
const ZONED: Record<string, number> = {
  toLocalDate: 2,
  toLocalMonth: 2,
  startOfLocalDay: 2,
  endOfLocalDay: 2,
  localMonthRange: 2,
  localParts: 2,
  zonedTimeToUtc: 2,
  formatClock: 2,
  formatWhen: 4,
  pickDate: 2,
  pickTime: 3,
};

/** Where the default zone may live: the helpers that define the fallback. */
const ALLOWED = ["lib/user-time.ts", "lib/format.ts", "lib/pick-date.ts"];

/** Counts a call's top-level arguments, starting just after its opening bracket. */
export function countArgs(text: string, open: number): number {
  let depth = 0;
  let args = 0;
  let seen = false;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const c = text.charAt(i);
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      seen = true;
    } else if ("([{".includes(c)) {
      depth++;
      seen = true;
    } else if (")]}".includes(c)) {
      if (depth === 0) return seen ? args + 1 : 0;
      depth--;
    } else if (c === "," && depth === 0) {
      // A trailing comma before ")" doesn't start another argument.
      if (/^\s*\)/.test(text.slice(i + 1))) return args + 1;
      args++;
    } else if (!/\s/.test(c)) seen = true;
  }
  return args;
}

function zoneless(text: string): string[] {
  const found: string[] = [];
  for (const [name, needed] of Object.entries(ZONED)) {
    for (const match of text.matchAll(new RegExp(`(?<![\\w.])${name}\\(`, "g"))) {
      const before = text.slice(Math.max(0, match.index - 9), match.index);
      if (/function\s*$/.test(before)) continue; // the definition itself
      if (countArgs(text, match.index + match[0].length) < needed)
        found.push(`${name} (line ${text.slice(0, match.index).split("\n").length})`);
    }
  }
  return found;
}

describe("time zone", () => {
  test("the argument counter handles nesting, objects and strings", () => {
    const at = (s: string) => countArgs(s, s.indexOf("(") + 1);
    expect(at("toLocalDate(Date.now())")).toBe(1);
    expect(at("toLocalDate(Date.now(), timeZone)")).toBe(2);
    expect(at("zonedTimeToUtc({ ...parseLocalDate(d), hour: 10 })")).toBe(1);
    expect(at('formatWhen(ms, true, Date.now(), "a,b")')).toBe(4);
    expect(at("pickDate()")).toBe(0);
    expect(at("pickDate(\n  start,\n  timeZone,\n)")).toBe(2);
  });

  test("no screen works out a day or month in the default zone", () => {
    const offenders = files(SRC)
      .map((path) => ({ name: relative(SRC, path), text: readFileSync(path, "utf8") }))
      .filter(({ name }) => !ALLOWED.includes(name))
      .flatMap(({ name, text }) => zoneless(text).map((call) => `${name}: ${call}`));
    expect(offenders).toEqual([]);
  });

  test("screens take today from useTodayDate(), which turns over at midnight", () => {
    const offenders = files(SRC)
      .filter((path) => path.endsWith(".tsx"))
      .filter((path) => /to(LocalDate|LocalMonth)\(Date\.now\(\)/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });

  test("only one hook is called useToday", () => {
    const exporters = files(SRC)
      .filter((path) => /export function useToday\b/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path));
    expect(exporters).toEqual(["lib/use-today.ts"]);
  });
});
