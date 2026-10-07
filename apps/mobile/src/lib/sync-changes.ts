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
import { createChangePuller } from "./sync-pull";

/** Pulls what changed on the server since the last look; see createChangePuller. */
export const pullChanges = createChangePuller({
  readyUser: () => {
    const userId = profileStore.get()?.id;
    return userId && currentToken() && onlineManager.isOnline() ? userId : null;
  },
  storage: AsyncStorage,
  outbox,
  fetchSummary: (since) => send("GET", `/sync/changes?since=${since}&summary=true`),
  refresh: scheduleRefresh,
  now: editTime,
});

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
