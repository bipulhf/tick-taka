import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { sourceFiles } from "./helpers/source-files";

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

/**
 * Calls of the zoned helpers with too few arguments to pass the zone, found by the
 * TypeScript parser: comments, strings and regex literals can't be mistaken for code.
 */
function zoneless(text: string): string[] {
  const source = ts.createSourceFile(
    "file.tsx",
    text,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const needed = ZONED[name];
      if (needed !== undefined && node.arguments.length < needed) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push(`${name} (line ${line})`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("time zone", () => {
  test("the check counts real arguments, not commas in strings or comments", () => {
    expect(zoneless("toLocalDate(Date.now())")).toEqual(["toLocalDate (line 1)"]);
    expect(zoneless("toLocalDate(Date.now(), timeZone)")).toEqual([]);
    expect(zoneless("zonedTimeToUtc({ ...parseLocalDate(d), hour: 10 })")).toHaveLength(1);
    expect(zoneless('formatWhen(ms, true, Date.now(), "a,b")')).toEqual([]);
    expect(zoneless('formatWhen(ms, true, "a,b,c")')).toEqual(["formatWhen (line 1)"]);
    expect(zoneless("pickDate(\n  start,\n  timeZone,\n)")).toEqual([]);
    expect(zoneless("x;\ntoLocalMonth(now /* , zone */)")).toEqual(["toLocalMonth (line 2)"]);
    expect(zoneless("toLocalMonth(now, /,/.source)")).toEqual([]);
    // A method of the same name, and the helper's own definition, aren't calls of it.
    expect(zoneless("intl.toLocalDate(now)")).toEqual([]);
    expect(zoneless("export function toLocalDate(ms: number, timeZone = TZ) {}")).toEqual([]);
  });

  test("no screen works out a day or month in the default zone", () => {
    const offenders = sourceFiles()
      .filter(({ path }) => !ALLOWED.includes(path))
      .flatMap(({ path, text }) => zoneless(text).map((call) => `${path}: ${call}`));
    expect(offenders).toEqual([]);
  });

  test("screens take today from useTodayDate(), which turns over at midnight", () => {
    const offenders = sourceFiles(/\.tsx$/)
      .filter(({ text }) => /to(LocalDate|LocalMonth)\(Date\.now\(\)/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  test("only one hook is called useToday", () => {
    const exporters = sourceFiles()
      .filter(({ text }) => /export function useToday\b/.test(text))
      .map(({ path }) => path);
    expect(exporters).toEqual(["lib/use-today.ts"]);
  });
});
