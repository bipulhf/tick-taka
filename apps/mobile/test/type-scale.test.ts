import { describe, expect, test } from "bun:test";
import { sourceFiles } from "./helpers/source-files";

/** DESIGN.md: Caption (13) is the smallest text; tab labels (12) are the one exception. */
const SMALLEST = 13;
const EXCEPTIONS: Record<string, number> = { "components/navigation/tab-bar.tsx": 12 };

describe("type scale", () => {
  test("no text, chart axes included, is set below Caption size", () => {
    const offenders = sourceFiles().flatMap(({ path: name, text }) => {
      const floor = EXCEPTIONS[name] ?? SMALLEST;
      return [...text.matchAll(/fontSize:\s*(\d+)|text-\[(\d+)px\]/g)]
        .map((m) => Number(m[1] ?? m[2]))
        .filter((size) => size < floor)
        .map((size) => `${name}: ${size}`);
    });
    expect(offenders).toEqual([]);
  });
});
