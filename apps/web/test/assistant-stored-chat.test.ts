import { expect, test } from "bun:test";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import {
  fromStored,
  hasNewReplies,
  mergeStored,
  type StoredMessage,
} from "../src/features/assistant/stored-chat";

const stored = (id: string, role: "user" | "assistant", extra: Partial<StoredMessage> = {}) =>
  ({
    id,
    role,
    content: `${role} ${id}`,
    memo: null,
    cards: [],
    actions: [],
    rating: null,
    createdAt: 1,
    ...extra,
  }) satisfies StoredMessage;

test("fromStored keeps memo, cards, actions and rating, without Undo", () => {
  const card = { type: "record" as const, kind: "task" as const, id: "T", title: "Milk" };
  expect(
    fromStored(
      stored("R1", "assistant", {
        memo: "added task T",
        cards: [card],
        actions: [{ summary: "Added task" }],
        rating: "up",
      }),
    ),
  ).toEqual({
    id: "stored-R1",
    role: "assistant",
    content: "assistant R1",
    memo: "added task T",
    actions: [{ summary: "Added task" }],
    messageId: "R1",
    cards: [card],
    rating: "up",
    at: 1,
  });
  expect(fromStored(stored("U1", "user"))).toEqual({
    id: "stored-U1",
    role: "user",
    content: "user U1",
    at: 1,
  });
});

const local: ChatMessage[] = [
  { id: "l1", role: "user", content: "add milk", at: 1 },
  {
    id: "l2",
    role: "assistant",
    content: "Added",
    messageId: "R1",
    actions: [{ summary: "Added task", undo: { method: "DELETE", path: "/tasks/T" } }],
    at: 2,
  },
];
const server = [stored("U1", "user"), stored("R1", "assistant")];

test("hasNewReplies only when the server has a reply this browser hasn't seen", () => {
  expect(hasNewReplies(local, server)).toBe(false);
  expect(hasNewReplies(local, [...server, stored("U2", "user"), stored("R2", "assistant")])).toBe(
    true,
  );
});

test("mergeStored keeps this browser's copy of known turns, with their Undo", () => {
  const merged = mergeStored(local, [...server, stored("U2", "user"), stored("R2", "assistant")]);
  expect(merged.map((m) => m.id)).toEqual(["l1", "l2", "stored-U2", "stored-R2"]);
  expect(merged[1]?.actions?.[0]?.undo).toBeDefined();
});
