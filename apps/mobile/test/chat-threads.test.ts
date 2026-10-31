import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import {
  asksToGoAhead,
  type LocalThread,
  mergeThread,
  type ServerMessage,
  threadList,
  threadTitle,
} from "../src/features/assistant/chat-threads";

const server = (id: string, role: "user" | "assistant", content: string, at: number) =>
  ({
    id,
    role,
    content,
    memo: null,
    cards: [],
    actions: [],
    rating: null,
    createdAt: at,
  }) satisfies ServerMessage;

const local = (fields: Partial<ChatMessage> & Pick<ChatMessage, "role" | "content" | "at">) =>
  ({ id: `l-${fields.at}`, ...fields }) as ChatMessage;

describe("mergeThread", () => {
  const undo = { method: "DELETE" as const, path: "/tasks/1" };

  test("with no copy on the phone, the server's is the chat", () => {
    const merged = mergeThread(
      [],
      [server("s1", "user", "Hi", 1), server("s2", "assistant", "Hello", 2)],
    );
    expect(merged.map((m) => m.serverId)).toEqual(["s1", "s2"]);
  });

  test("the phone's copy keeps its Undo and gains replies written elsewhere", () => {
    const phone = [
      local({ role: "user", content: "Add milk", at: 10 }),
      local({
        role: "assistant",
        content: "Added",
        at: 11,
        serverId: "s2",
        actions: [{ summary: "Added", undo }],
      }),
    ];
    const merged = mergeThread(phone, [
      server("s1", "user", "Add milk", 10),
      server("s2", "assistant", "Added", 11),
      server("s3", "user", "And eggs", 20),
      server("s4", "assistant", "Added eggs", 21),
    ]);
    expect(merged.map((m) => m.content)).toEqual(["Add milk", "Added", "And eggs", "Added eggs"]);
    expect(merged[1]?.actions?.[0]?.undo).toEqual(undo);
  });

  test("nothing new elsewhere: the phone's copy stands, failed turn and all", () => {
    const phone = [
      local({ role: "assistant", content: "Added", at: 11, serverId: "s2" }),
      local({ role: "user", content: "Move it", at: 12 }),
      local({ role: "assistant", content: "I couldn't connect", at: 13, failed: true }),
    ];
    const merged = mergeThread(phone, [
      server("s2", "assistant", "Added", 11),
      // The server kept the question of the turn that failed.
      server("s3", "user", "Move it", 12),
    ]);
    expect(merged).toEqual(phone);
  });

  test("ratings follow the server", () => {
    const phone = [
      local({ role: "assistant", content: "Added", at: 11, serverId: "s2", rating: "down" }),
    ];
    const merged = mergeThread(phone, [
      { ...server("s2", "assistant", "Added", 11), rating: "up" },
    ]);
    expect(merged[0]?.rating).toBe("up");
    const cleared = mergeThread(phone, [server("s2", "assistant", "Added", 11)]);
    expect(cleared[0]?.rating).toBeUndefined();
  });

  test("nothing lines up: the server wins, unless the phone's copy was never stored", () => {
    const remote = [server("s9", "assistant", "Elsewhere", 5)];
    expect(
      mergeThread([local({ role: "assistant", content: "Old", at: 1, serverId: "gone" })], remote),
    ).toEqual([expect.objectContaining({ serverId: "s9" })]);
    const offline = [local({ role: "user", content: "Written offline", at: 1 })];
    expect(mergeThread(offline, remote)).toEqual(offline);
  });
});

describe("threadList", () => {
  const thread = (id: string, updatedAt: number, extra: Partial<LocalThread> = {}) => ({
    id,
    title: id,
    updatedAt,
    messageCount: 2,
    synced: true,
    ...extra,
  });

  test("newest first, ties by id", () => {
    const rows = threadList([thread("a", 1), thread("c", 5), thread("b", 5)], []);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  test("adds chats only this phone has, and drops ones deleted elsewhere", () => {
    const rows = threadList(
      [thread("a", 1)],
      [
        thread("offline", 9, { synced: false }),
        thread("deleted", 8),
        thread("empty", 7, { synced: false, messageCount: 0 }),
        thread("a", 6, { messageCount: 4 }),
      ],
    );
    expect(rows.map((r) => [r.id, r.local, r.updatedAt, r.messageCount])).toEqual([
      ["offline", true, 9, 2],
      ["a", false, 6, 4],
    ]);
  });

  test("offline, the phone's own copies are the list", () => {
    const rows = threadList(undefined, [thread("a", 1), thread("b", 2, { synced: false })]);
    expect(rows.map((r) => [r.id, r.local])).toEqual([
      ["b", true],
      ["a", false],
    ]);
  });
});

test("threadTitle matches the server's", () => {
  const user = (content: string) => local({ role: "user", content, at: 1 });
  expect(threadTitle([])).toBe("New chat");
  expect(threadTitle([user("  Add   milk\nplease ")])).toBe("Add milk please");
  const long = threadTitle([user("word ".repeat(30))]);
  expect(long.length).toBeLessThanOrEqual(60);
  expect(long.endsWith("word")).toBe(true);
});

test("asksToGoAhead spots a question before acting", () => {
  expect(asksToGoAhead("I'll move 7 tasks to Friday. Go ahead?")).toBe(true);
  expect(asksToGoAhead("That's 12 bills. Should I mark them all paid?")).toBe(true);
  expect(asksToGoAhead("৭টা কাজ শুক্রবারে সরিয়ে দেব?")).toBe(true);
  expect(asksToGoAhead("Moved 7 tasks to Friday.")).toBe(false);
  expect(asksToGoAhead("Which account was it from?")).toBe(false);
  expect(asksToGoAhead("Go ahead? No, I already did it.")).toBe(false);
});
