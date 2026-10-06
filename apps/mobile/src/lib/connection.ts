import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { outbox } from "./outbox";

/** Whether the phone has a network right now (the outbox waits while it doesn't). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Saved changes not yet on the server: queued offline, or still sending. */
export function usePendingWrites(): number {
  return useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.size,
    () => 0,
  );
}
