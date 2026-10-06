import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dir, "../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * DESIGN.md: purple is for habits, and mango only for the one primary action. Purple
 * marks are allowed in habit code and on habit rows elsewhere (named here); a new
 * use needs a deliberate entry.
 */
const GRAPE_OK = [
  "features/habits/",
  "features/review/shutdown-flow.tsx", // the shutdown's habit checkboxes
  "features/review/weekly-review.tsx", // the review's habit step
  "features/plan/plan-home.tsx", // the Habits tile
  "app/login.tsx", // the Habits feature line
];

describe("colour meaning", () => {
  test("purple marks appear only for habits", () => {
    const offenders = files(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => !GRAPE_OK.some((ok) => path.startsWith(ok)))
      .filter((path) =>
        /(iconColor|tone|color)(=|: )["{]*"grape"/.test(readFileSync(join(SRC, path), "utf8")),
      );
    expect(offenders).toEqual([]);
  });

  test("list rows never use mango as an icon colour", () => {
    const offenders = files(SRC).filter((path) =>
      /iconColor=["{]*"mango"/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
