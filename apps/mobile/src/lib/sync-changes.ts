import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { send } from "./api";
import { profileStore } from "./auth";
import { currentToken } from "./http";
import { outbox } from "./outbox";
import { scheduleRefresh } from "./query-client";
import { editTime } from "./server-clock";
import { changedPaths, syncChangesSchema } from "./sync-paths";

const KEY = "tt.last-sync";
let running = false;

function outboxEmpty(timeoutMs = 30_000): Promise<boolean> {
  if (outbox.size === 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, timeoutMs);
    const stop = outbox.subscribe(() => {
      if (outbox.size > 0) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
  });
}

/**
 * Asks the server what changed since the last look (GET /sync/changes): edits
 * made by the assistant, the widget or another device. Only the screens those
 * tables feed are refreshed, the same way a local write refreshes them. Waits for
 * queued writes to land first so a refetch doesn't hide them.
 */
export async function pullChanges(): Promise<void> {
  const userId = profileStore.get()?.id;
  if (running || !userId || !currentToken() || !onlineManager.isOnline()) return;
  running = true;
  const key = `${KEY}.${userId}`;
  try {
    const stored = Number(await AsyncStorage.getItem(key));
    if (!stored) {
      // First run for this user: everything on screen was just fetched; start from now.
      await AsyncStorage.setItem(key, String(editTime()));
      return;
    }
    // Queued writes land first, so a refetch doesn't hide them; try later if they don't.
    if (!(await outboxEmpty())) return;
    const reply = syncChangesSchema.safeParse(await send("GET", `/sync/changes?since=${stored}`));
    if (!reply.success) return;
    for (const path of changedPaths(reply.data.changes)) scheduleRefresh(path);
    await AsyncStorage.setItem(key, String(reply.data.serverTime));
  } catch (error) {
    // Offline or refused: the next reconnect or foreground tries again.
    console.warn("sync: couldn't pull changes", error);
  } finally {
    running = false;
  }
}

/** Pulls changes now, on reconnect and whenever the app comes back to the front. */
export function useChangeSync(): void {
  useEffect(() => {
    void pullChanges();
    const offline = onlineManager.subscribe((online) => {
      if (online) void pullChanges();
    });
    const foreground = AppState.addEventListener("change", (status) => {
      if (status === "active") void pullChanges();
    });
    return () => {
      offline();
      foreground.remove();
    };
  }, []);
}
