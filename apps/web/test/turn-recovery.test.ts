import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import { createTurnRecovery } from "../src/features/assistant/turn-recovery";

const NOW = 1_000_000;
const row = (fields: Record<string, unknown>) => ({
  createdAt: 50,
  updatedAt: 5_000,
  deletedAt: null,
  ...fields,
});

function setup(options: { reply?: unknown; fails?: boolean; own?: string[]; at?: number } = {}) {
  let messages: ChatMessage[] = [
    {
      id: "m1",
      role: "assistant",
      content: "Done",
      at: options.at ?? NOW - 20_000,
      recover: { since: 1_000, until: 200_000 },
    },
  ];
  const asked: number[] = [];
  const refreshed: string[] = [];
  const recover = createTurnRecovery({
    messages: () => messages,
    update: (id, change) => {
      messages = messages.map((m) => (m.id === id ? change(m) : m));
    },
    fetchChanges: async (since) => {
      asked.push(since);
      if (options.fails) throw new Error("offline");
      return options.reply ?? { serverTime: NOW, changes: {} };
    },
    ownIds: () => new Set(options.own ?? []),
    refresh: (path) => refreshed.push(path),
    now: () => NOW,
    settleMs: 15_000,
  });
  return { recover, asked, refreshed, message: () => messages[0] };
}

describe("recovering a turn whose stream dropped (QA-309)", () => {
  test("Tiki's changes in the window come back with Undo; the phone's own writes don't", async () => {
    const { recover, asked, refreshed, message } = setup({
      own: ["x1"],
      reply: {
        serverTime: NOW,
        changes: {
          tasks: [row({ id: "t1", title: "Call bank", createdAt: 2_000, parentId: null })],
          transactions: [row({ id: "x1", note: null, amountMinor: 25_000, createdAt: 3_000 })],
        },
      },
    });
    await recover();
    expect(asked).toEqual([999]);
    expect(message()?.recover).toBeUndefined();
    expect(message()?.actions).toEqual([
      { summary: 'Added task "Call bank"', undo: { method: "DELETE", path: "/tasks/t1" } },
    ]);
    expect(message()?.content).toContain("Tiki kept working after the connection dropped");
    expect(refreshed.sort()).toEqual(["/tasks", "/transactions"]);
  });

  test("it waits for the server's loop to settle, and stays pending while offline", async () => {
    const early = setup({ at: NOW - 5_000 });
    await early.recover();
    expect(early.asked).toEqual([]);

    const offline = setup({ fails: true });
    await offline.recover();
    expect(offline.message()?.recover).toEqual({ since: 1_000, until: 200_000 });
  });

  test("a capped reply refreshes everything; after a week it gives up", async () => {
    const capped = setup({ reply: { serverTime: NOW, changes: {}, more: true } });
    await capped.recover();
    expect(capped.refreshed).toEqual(["/"]);

    const old = setup({ at: NOW - 8 * 86_400_000 });
    await old.recover();
    expect(old.asked).toEqual([]);
    expect(old.message()?.recover).toBeUndefined();
  });
});
