import type { ChatDeletion, ChatMessage } from "./chat-store";

/**
 * A change the chat sends for the user (a saved draft, an Undo, the deletions they
 * said yes to) is shown as done at once, even offline. When the outbox reports it
 * refused (or set aside as stuck), the message goes back, so the chat never claims
 * what didn't happen. Pure, so it can be tested.
 */

const withoutPart = (memo: string | undefined, part: string) =>
  memo
    ?.split("; ")
    .filter((line) => line !== part)
    .join("; ");

/** The memo line a confirmed deletion adds, naming what was deleted. */
export const deletedMemo = (deletions: readonly ChatDeletion[]) =>
  `the user confirmed and deleted ${deletions.map((item) => item.path).join(", ")}`;

/**
 * A saved draft that didn't go through: the card offers Save again, and the
 * "Saved" row and memo line it added go.
 */
export function draftRefused(
  message: ChatMessage,
  index: number,
  added: { summary: string; memo: string },
): ChatMessage {
  return {
    ...message,
    drafts: message.drafts?.map((draft, i) =>
      i === index ? { ...draft, state: "pending" as const } : draft,
    ),
    actions: message.actions?.filter((action) => action.summary !== added.summary),
    memo: withoutPart(message.memo, added.memo) || undefined,
  };
}

/** An Undo that didn't go through: offered again. */
export function undoRefused(message: ChatMessage, index: number): ChatMessage {
  return {
    ...message,
    actions: message.actions?.map((action, i) => {
      if (i !== index) return action;
      const { undone: _, ...rest } = action;
      return rest;
    }),
  };
}

/**
 * Deletions the server refused, of those `sent`: their rows (and Undo) go, the card
 * asks again about just those, and the memo names only what was deleted.
 */
export function deletionsRefused(
  message: ChatMessage,
  sent: readonly ChatDeletion[],
  refused: readonly ChatDeletion[],
): ChatMessage {
  if (refused.length === 0) return message;
  const restores = new Set(refused.map((item) => `${item.path}/restore`));
  const deleted = sent.filter((item) => !refused.includes(item));
  const memo = [
    withoutPart(message.memo, deletedMemo(sent)),
    deleted.length ? deletedMemo(deleted) : null,
  ]
    .filter(Boolean)
    .join("; ");
  return {
    ...message,
    deletions: [...refused],
    deletionChoice: "pending",
    actions: message.actions?.filter(
      (action) => !(action.undo?.method === "POST" && restores.has(action.undo.path)),
    ),
    memo: memo || undefined,
  };
}
