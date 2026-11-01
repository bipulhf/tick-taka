import { expect, test } from "bun:test";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import {
  deletedMemo,
  deletionsRefused,
  undoRefused,
} from "../src/features/assistant/refused-writes";

const a = { summary: "Task “Call Rafiq”", path: "/tasks/A" };
const b = { summary: "Task “Pay rent”", path: "/tasks/B" };

/** A reply after the user clicked Delete on both. */
const confirmed = (): ChatMessage => ({
  id: "m1",
  role: "assistant",
  content: "Delete these 2?",
  at: 0,
  memo: `found 2 tasks; ${deletedMemo([a, b])}`,
  deletions: [a, b],
  deletionChoice: "deleted",
  actions: [
    { summary: "Added task “Buy milk”", undo: { method: "DELETE", path: "/tasks/C" } },
    { summary: "Deleted task “Call Rafiq”", undo: { method: "POST", path: "/tasks/A/restore" } },
    { summary: "Deleted task “Pay rent”", undo: { method: "POST", path: "/tasks/B/restore" } },
  ],
});

test("a refused undo is offered again", () => {
  const message: ChatMessage = {
    id: "m1",
    role: "assistant",
    content: "",
    at: 0,
    actions: [
      { summary: "Added task", undo: { method: "DELETE", path: "/tasks/A" }, undone: true },
      { summary: "Added task", undo: { method: "DELETE", path: "/tasks/B" }, undone: true },
    ],
  };
  const back = undoRefused(message, 1);
  expect(back.actions?.[0]?.undone).toBe(true);
  expect(back.actions?.[1]).toEqual({
    summary: "Added task",
    undo: { method: "DELETE", path: "/tasks/B" },
  });
});

test("deletions all refused: the card asks again and nothing reads as deleted", () => {
  const back = deletionsRefused(confirmed(), [a, b], [a, b]);
  expect(back.deletionChoice).toBe("pending");
  expect(back.deletions).toEqual([a, b]);
  expect(back.actions?.map((action) => action.summary)).toEqual(["Added task “Buy milk”"]);
  expect(back.memo).toBe("found 2 tasks");
});

test("one deletion refused: the other stays deleted, the card asks about the refused one", () => {
  const back = deletionsRefused(confirmed(), [a, b], [b]);
  expect(back.deletionChoice).toBe("pending");
  expect(back.deletions).toEqual([b]);
  expect(back.actions?.map((action) => action.summary)).toEqual([
    "Added task “Buy milk”",
    "Deleted task “Call Rafiq”",
  ]);
  expect(back.memo).toBe(`found 2 tasks; ${deletedMemo([a])}`);
});

test("nothing refused leaves the message as it is", () => {
  const message = confirmed();
  expect(deletionsRefused(message, [a, b], [])).toBe(message);
});

test("with no memo before, all refused leaves none", () => {
  const { memo: _, ...rest } = confirmed();
  const message = { ...rest, memo: deletedMemo([a, b]) };
  expect(deletionsRefused(message, [a, b], [a, b]).memo).toBeUndefined();
});
