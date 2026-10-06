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

/** DESIGN.md: Caption (13) is the smallest text; tab labels (12) are the one exception. */
const SMALLEST = 13;
const EXCEPTIONS: Record<string, number> = { "components/navigation/tab-bar.tsx": 12 };

describe("type scale", () => {
  test("no text, chart axes included, is set below Caption size", () => {
    const offenders = files(SRC).flatMap((path) => {
      const name = relative(SRC, path);
      const floor = EXCEPTIONS[name] ?? SMALLEST;
      const text = readFileSync(path, "utf8");
      return [...text.matchAll(/fontSize:\s*(\d+)|text-\[(\d+)px\]/g)]
        .map((m) => Number(m[1] ?? m[2]))
        .filter((size) => size < floor)
        .map((size) => `${name}: ${size}`);
    });
    expect(offenders).toEqual([]);
  });
});
