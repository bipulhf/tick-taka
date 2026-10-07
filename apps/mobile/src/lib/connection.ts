import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { outbox } from "./outbox";
import type { OutboxEntry } from "./outbox-policy";

/** Whether the phone has a network right now (the outbox waits while it doesn't). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}

function useOutbox<T>(read: () => T, initial: T): T {
  return useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    read,
    () => initial,
  );
}

/** Saved changes not yet on the server: queued offline, still sending, or stuck. */
export function usePendingWrites(): number {
  return useOutbox(() => outbox.size, 0);
}

/** Writes the server kept failing on, waiting for the user to retry or discard them. */
export function useStuckWrites(): readonly OutboxEntry[] {
  return useOutbox(() => outbox.stuck(), NONE);
}
const NONE: readonly OutboxEntry[] = [];

/** The first queued write has failed a few times: online, but not getting through. */
export function useSyncStalled(): boolean {
  return useOutbox(() => (outbox.snapshot()[0]?.attempts ?? 0) >= 3, false);
}

/** The changes saved on this phone can't be read right now (the storage key). */
export function useSavedQueueUnreadable(): boolean {
  return useOutbox(() => outbox.savedUnreadable, false);
}

/** The last save of the queued changes failed: they are only in memory for now. */
export function useQueueNotSaved(): boolean {
  return useOutbox(() => outbox.notSaved, false);
}
