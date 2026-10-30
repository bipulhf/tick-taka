import { send } from "@/lib/api";
import { scheduleRefresh } from "@/lib/query-client";
import { chatStore, updateMessage } from "./chat-store";
import { ownWrites } from "./own-writes";
import { createTurnRecovery } from "./turn-recovery";

/** Give the server's loop time to notice the browser left and stop before looking. */
export const SETTLE_MS = 15_000;

/** Looks up what Tiki changed after a turn's stream dropped; see createTurnRecovery. */
export const recoverDroppedTurns = createTurnRecovery({
  messages: () => chatStore.get(),
  update: updateMessage,
  fetchChanges: (since) => send("GET", `/sync/changes?since=${since}`),
  ownIds: () => ownWrites.ids(),
  refresh: scheduleRefresh,
  now: Date.now,
  settleMs: SETTLE_MS,
});
