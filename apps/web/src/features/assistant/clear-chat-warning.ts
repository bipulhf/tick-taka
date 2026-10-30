import { plural } from "@/lib/format";
import type { ChatMessage } from "./chat-store";

/**
 * What clearing the chat would throw away: drafts and deletions still waiting for an
 * answer, and changes whose Undo lives only in the chat. Null when nothing would be
 * lost, so "New chat" can clear at once. Pure, so it can be tested.
 */
export function clearChatWarning(messages: ChatMessage[]): string | null {
  let waiting = 0;
  let undoable = 0;
  for (const message of messages) {
    waiting += message.drafts?.filter((draft) => draft.state === "pending").length ?? 0;
    if (message.deletionChoice === "pending") waiting += message.deletions?.length ?? 0;
    undoable += message.actions?.filter((action) => action.undo && !action.undone).length ?? 0;
  }
  const parts = [
    waiting
      ? `${plural(waiting, "change")} ${waiting === 1 ? "is" : "are"} waiting for your answer`
      : null,
    undoable ? `${plural(undoable, "change")} can still be undone here` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts.join(", and ")}. A new chat drops ${waiting + undoable === 1 ? "it" : "them"}.`;
}
