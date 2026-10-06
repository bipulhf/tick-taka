import { describe, expect, test } from "bun:test";
import { knownIds, recoveredActions } from "../src/features/assistant/recovered-actions";
import { syncChangesSchema } from "../src/lib/sync-paths";

const window = { since: 1_000, until: 200_000 };
const row = (fields: Record<string, unknown>) => ({
  createdAt: 50,
  updatedAt: 5_000,
  deletedAt: null,
  ...fields,
});

describe("recovering a turn whose stream dropped", () => {
  test("records added during the turn come back with Undo", () => {
    const actions = recoveredActions(
      {
        tasks: [row({ id: "t1", title: "Call bank", createdAt: 2_000, parentId: null })],
        transactions: [row({ id: "x1", note: null, amountMinor: 25_000, createdAt: 3_000 })],
      },
      window,
      new Set(),
    );
    expect(actions).toEqual([
      { summary: 'Added task "Call bank"', undo: { method: "DELETE", path: "/tasks/t1" } },
      { summary: "Added transaction of 250", undo: { method: "DELETE", path: "/transactions/x1" } },
    ]);
  });

  test("changed records are listed without Undo, since the old values are unknown", () => {
    const actions = recoveredActions(
      { goals: [row({ id: "g1", name: "Laptop" })] },
      window,
      new Set(),
    );
    expect(actions).toEqual([{ summary: 'Changed goal "Laptop"' }]);
  });

  test("ones already shown, outside the turn, deleted, or subtasks of an added task are skipped", () => {
    const actions = recoveredActions(
      {
        tasks: [
          row({ id: "seen", title: "Seen", createdAt: 2_000 }),
          row({ id: "late", title: "Later edit", updatedAt: 900_000 }),
          row({ id: "gone", title: "Gone", deletedAt: 4_000 }),
          row({ id: "p", title: "Parent", createdAt: 2_000 }),
          row({ id: "c", title: "Child", createdAt: 2_000, parentId: "p" }),
        ],
        settings: [{ key: "x", updatedAt: 5_000 }],
      },
      window,
      knownIds([{ summary: "Added task", undo: { method: "DELETE", path: "/tasks/seen" } }]),
    );
    expect(actions.map((a) => a.summary)).toEqual(['Added task "Parent"']);
  });

  test("the sync reply is checked before use", () => {
    expect(syncChangesSchema.safeParse({ serverTime: 1, changes: { tasks: [] } }).success).toBe(
      true,
    );
    expect(syncChangesSchema.safeParse({ changes: "nope" }).success).toBe(false);
  });
});
