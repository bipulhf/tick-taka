import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { OutboxRequest } from "./query-client";

/**
 * Returns a function that queues a write. It runs now when online, or later in
 * order when offline. Pair with an optimistic cache update for instant screens.
 */
export function useOutbox() {
  const mutation = useMutation<unknown, Error, OutboxRequest>({ mutationKey: ["outbox"] });
  const { mutate, mutateAsync } = mutation;
  const queue = useCallback((request: OutboxRequest) => mutate(request), [mutate]);
  return Object.assign(queue, { async: mutateAsync });
}
