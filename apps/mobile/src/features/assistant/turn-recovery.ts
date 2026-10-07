import { changedPaths, syncChangesSchema } from "@/lib/sync-paths";
import type { ChatMessage } from "./chat-store";
import { knownIds, recoveredActions } from "./recovered-actions";

/** After a week, nobody is going to undo it from the chat any more. */
const GIVE_UP_MS = 7 * 86_400_000;

const NOTE =
  "Tiki kept working after the connection dropped. These changes were made; undo any you didn't want.";

export interface TurnRecoveryDeps {
  messages(): readonly ChatMessage[];
  update(id: string, change: (message: ChatMessage) => ChatMessage): void;
  /** GET /sync/changes?since=… (rows, not a summary). */
  fetchChanges(since: number): Promise<unknown>;
  /** Record ids the phone's own outbox wrote lately: never offered as Tiki's. */
  ownIds(): Set<string>;
  refresh(path: string): void;
  now(): number;
  /** Give the server's loop time to notice the phone left and stop before looking. */
  settleMs: number;
}

/**
 * For every turn whose stream dropped, asks the server what changed while it ran
 * and adds those changes to the message, with Undo for anything added. Offline, it
 * stays pending and runs again later.
 */
export function createTurnRecovery(deps: TurnRecoveryDeps): () => Promise<void> {
  const running = new Set<string>();
  return async () => {
    const now = deps.now();
    for (const message of deps.messages()) {
      const window = message.recover;
      if (!window || running.has(message.id) || now - message.at < deps.settleMs) continue;
      if (now - message.at > GIVE_UP_MS) {
        deps.update(message.id, (m) => ({ ...m, recover: undefined }));
        continue;
      }
      running.add(message.id);
      try {
        const reply = syncChangesSchema.safeParse(await deps.fetchChanges(window.since - 1));
        // Rows Tiki already reported, and rows the phone's own outbox wrote meanwhile.
        const ownOrKnown = new Set([...knownIds(message.actions ?? []), ...deps.ownIds()]);
        const found = reply.success ? recoveredActions(reply.data.changes, window, ownOrKnown) : [];
        deps.update(message.id, (m) => ({
          ...m,
          recover: undefined,
          content: found.length ? `${m.content}\n\n${NOTE}` : m.content,
          actions: [...(m.actions ?? []), ...found],
        }));
        // Refresh only the screens the found changes feed; everything if the reply
        // was capped, since some changes weren't in it.
        if (reply.success && reply.data.more) deps.refresh("/");
        else if (found.length)
          for (const path of changedPaths(reply.data?.changes ?? {})) deps.refresh(path);
      } catch {
        // Offline or unreachable: try again on the next chance.
      } finally {
        running.delete(message.id);
      }
    }
  };
}
