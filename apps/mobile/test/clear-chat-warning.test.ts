import { expect, test } from "bun:test";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import { clearChatWarning } from "../src/features/assistant/clear-chat-warning";

const message = (extra: Partial<ChatMessage>): ChatMessage => ({
  id: String(Math.random()),
  role: "assistant",
  content: "",
  at: 0,
  ...extra,
});
const draft = (state: "pending" | "saved" | "discarded") => ({
  summary: "Expense ৳120",
  method: "POST" as const,
  path: "/transactions",
  body: {},
  state,
});
const undo = { method: "DELETE" as const, path: "/tasks/1" };

test("nothing to lose: New chat clears at once", () => {
  expect(clearChatWarning([])).toBeNull();
  expect(
    clearChatWarning([
      message({ drafts: [draft("saved"), draft("discarded")] }),
      message({ actions: [{ summary: "Added", undo, undone: true }, { summary: "Asked" }] }),
      message({ deletions: [{ summary: "Rent", path: "/recurring/1" }], deletionChoice: "kept" }),
    ]),
  ).toBeNull();
});

test("pending drafts, deletions and live Undo rows are counted before clearing", () => {
  expect(clearChatWarning([message({ drafts: [draft("pending")] })])).toBe(
    "1 change is waiting for your answer. A new chat drops it.",
  );
  expect(
    clearChatWarning([
      message({ drafts: [draft("pending")] }),
      message({
        deletions: [{ summary: "Rent", path: "/recurring/1" }],
        deletionChoice: "pending",
      }),
      message({ actions: [{ summary: "Added", undo }] }),
    ]),
  ).toBe(
    "2 changes are waiting for your answer, and 1 change can still be undone here. A new chat drops them.",
  );
});
