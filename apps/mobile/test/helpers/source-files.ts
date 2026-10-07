import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** The app's source folder, which the design-rule tests scan. */
const SRC = join(import.meta.dir, "../../src");

function walk(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, pattern);
    return pattern.test(path) ? [path] : [];
  });
}

/**
 * Every source file under src whose name matches `pattern` (TypeScript and TSX by
 * default), with its path relative to src ("lib/format.ts") and its text.
 */
export function sourceFiles(pattern = /\.tsx?$/): { path: string; text: string }[] {
  return walk(SRC, pattern).map((path) => ({
    path: relative(SRC, path),
    text: readFileSync(path, "utf8"),
  }));
}
