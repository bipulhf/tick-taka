import { send } from "@/lib/api";
import { scheduleRefresh } from "@/lib/query-client";
import { changedPaths, syncChangesSchema } from "@/lib/sync-paths";
import { chatStore, updateMessage } from "./chat-store";
import { knownIds, recoveredActions } from "./recovered-actions";

/** Give the server's loop time to notice the phone left and stop before looking. */
export const SETTLE_MS = 15_000;
/** After a week, nobody is going to undo it from the chat any more. */
const GIVE_UP_MS = 7 * 86_400_000;
const running = new Set<string>();

const NOTE =
  "Tiki kept working after the connection dropped. These changes were made; undo any you didn't want.";

/**
 * For every turn whose stream dropped, asks the server what changed while it ran
 * (GET /sync/changes) and adds those changes to the message, with Undo for anything
 * added. Offline, it stays pending and runs again later.
 */
export async function recoverDroppedTurns(): Promise<void> {
  const now = Date.now();
  for (const message of chatStore.get()) {
    const window = message.recover;
    if (!window || running.has(message.id) || now - message.at < SETTLE_MS) continue;
    if (now - message.at > GIVE_UP_MS) {
      updateMessage(message.id, (m) => ({ ...m, recover: undefined }));
      continue;
    }
    running.add(message.id);
    try {
      const reply = syncChangesSchema.safeParse(
        await send("GET", `/sync/changes?since=${window.since - 1}`),
      );
      const found = reply.success
        ? recoveredActions(reply.data.changes, window, knownIds(message.actions ?? []))
        : [];
      updateMessage(message.id, (m) => ({
        ...m,
        recover: undefined,
        content: found.length ? `${m.content}\n\n${NOTE}` : m.content,
        actions: [...(m.actions ?? []), ...found],
      }));
      // Refresh only the screens the found changes feed; everything if the reply
      // was capped, since some changes weren't in it.
      if (reply.success && reply.data.more) scheduleRefresh("/");
      else if (found.length)
        for (const path of changedPaths(reply.data?.changes ?? {})) scheduleRefresh(path);
    } catch {
      // Offline or unreachable: try again on the next chance.
    } finally {
      running.delete(message.id);
    }
  }
}
