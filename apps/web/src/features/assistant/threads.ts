import { useQuery } from "@tanstack/react-query";
import { ApiError, api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { queryClient } from "@/lib/query-client";
import { notify, notifyError } from "@/lib/toast";
import { aboutStore } from "./ask-tiki";
import { chatStore, clearChat, replaceChat } from "./chat-store";
import { setThreadId, threadIdStore } from "./current-thread";
import { fromStored, hasNewReplies, mergeStored } from "./stored-chat";

/**
 * Chats kept on the server: the list, opening one, rename and delete with Undo. The
 * chat on screen stays in the browser too (chat-store), as the cache of the current one.
 */

const THREADS_KEY = ["assistant-threads"] as const;

export function useThreads(enabled: boolean) {
  return useQuery({
    queryKey: THREADS_KEY,
    queryFn: () => unwrap(api.ai.threads.$get()),
    enabled,
  });
}

export type ThreadSummary = NonNullable<ReturnType<typeof useThreads>["data"]>[number];

export const refreshThreads = () => void queryClient.invalidateQueries({ queryKey: THREADS_KEY });

const fetchThread = (id: string) => unwrap(api.ai.threads[":id"].$get({ param: { id } }));

/** A fresh, empty chat; it reaches the server with its first message. */
export function startNewChat() {
  clearChat();
  setThreadId(null);
  aboutStore.set(null);
}

/** Shows a chat from the list, loaded from the server. */
export async function openThread(id: string): Promise<void> {
  try {
    const thread = await fetchThread(id);
    replaceChat(thread.messages.map(fromStored));
    setThreadId(id);
    aboutStore.set(null);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notify("That chat was deleted");
      refreshThreads();
    } else notifyError(`Couldn't open the chat. ${friendlyError(error)}`);
  }
}

/**
 * Picks up replies sent to the current chat from another device. Replies already on
 * screen keep this browser's copy, with its Undo.
 */
export async function refreshCurrentThread(): Promise<void> {
  const id = threadIdStore.get();
  if (!id) return;
  try {
    const thread = await fetchThread(id);
    if (threadIdStore.get() !== id || !hasNewReplies(chatStore.get(), thread.messages)) return;
    replaceChat(mergeStored(chatStore.get(), thread.messages));
  } catch {
    // Offline, or the chat was deleted elsewhere: what's on screen stays.
  }
}

export async function renameThread(id: string, title: string): Promise<void> {
  try {
    await unwrap(api.ai.threads[":id"].$patch({ param: { id }, json: { title } }));
  } catch (error) {
    notifyError(`Couldn't rename the chat. ${friendlyError(error, "save")}`);
  }
  refreshThreads();
}

/** Deletes a chat with Undo in the toast; deleting the one on screen starts a new one. */
export async function deleteThread(id: string, title: string): Promise<void> {
  try {
    await unwrap(api.ai.threads[":id"].$delete({ param: { id } }));
  } catch (error) {
    notifyError(`Couldn't delete the chat. ${friendlyError(error, "save")}`);
    return;
  }
  if (threadIdStore.get() === id) startNewChat();
  refreshThreads();
  notify(`Deleted “${title}”`, {
    label: "Undo",
    onPress: () =>
      void unwrap(api.ai.threads[":id"].restore.$post({ param: { id } }))
        .catch((error) => notifyError(`Couldn't undo. ${friendlyError(error, "save")}`))
        .finally(refreshThreads),
  });
}
