import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(import.meta.dir, "..", path), "utf8");

describe("background reminder refresh", () => {
  test("the task is defined when the bundle loads, before the app's routes", () => {
    const entry = read("index.ts");
    const task = entry.indexOf('import "./src/features/notifications/background-reminders"');
    expect(task).toBeGreaterThan(-1);
    expect(task).toBeLessThan(entry.indexOf('import "expo-router/entry"'));
    expect(read("src/features/notifications/background-reminders.ts")).toMatch(
      /^TaskManager\.defineTask\(/m,
    );
  });
});
