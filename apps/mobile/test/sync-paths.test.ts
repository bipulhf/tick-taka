import { describe, expect, test } from "bun:test";
import { keysToRefresh } from "../src/lib/invalidation";
import { changedPaths, syncChangesSchema } from "../src/lib/sync-paths";

describe("refreshing after /sync/changes", () => {
  test("tables with rows map to their routes; empty tables are skipped", () => {
    expect(
      changedPaths({ tasks: [{}], habit_logs: [{}], habits: [{}], transactions: [] }).sort(),
    ).toEqual(["/habits", "/tasks"]);
    expect(changedPaths({ tasks: [], transactions: [] })).toEqual([]);
  });

  test("a task change refreshes task screens, not money ones", () => {
    const keys = keysToRefresh(changedPaths({ tasks: [{ id: "t" }] }));
    expect(keys).not.toBe("all");
    if (keys === "all") return;
    expect(keys.has("tasks")).toBe(true);
    expect(keys.has("today")).toBe(true);
    expect(keys.has("transactions")).toBe(false);
  });

  test("a transaction change refreshes money screens, not tasks", () => {
    const keys = keysToRefresh(changedPaths({ transactions: [{ id: "x" }] }));
    if (keys === "all") throw new Error("expected a scoped refresh");
    expect(keys.has("accounts")).toBe(true);
    expect(keys.has("tasks")).toBe(false);
  });

  test("settings or an unknown table refresh everything", () => {
    expect(keysToRefresh(changedPaths({ settings: [{ key: "theme" }] }))).toBe("all");
    expect(keysToRefresh(changedPaths({ brand_new_table: [{}] }))).toBe("all");
  });

  test("replies are checked before use", () => {
    expect(syncChangesSchema.safeParse({ serverTime: 5, changes: { tasks: [] } }).success).toBe(
      true,
    );
    expect(syncChangesSchema.safeParse({ serverTime: "5", changes: {} }).success).toBe(false);
  });
});
