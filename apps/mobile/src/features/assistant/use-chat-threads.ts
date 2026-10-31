import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError, api, unwrap } from "@/lib/api";
import { useIsOnline } from "@/lib/connection";
import { friendlyError } from "@/lib/error-copy";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { queryClient } from "@/lib/query-client";
import { useStore } from "@/lib/store";
import {
  type ChatMessage,
  chatStore,
  forgetThread,
  keepThread,
  localThreadsStore,
  newChat,
  readLocalThread,
  replaceMessages,
  switchThread,
  threadIdStore,
} from "./chat-store";
import { mergeThread, type ThreadRow, threadList } from "./chat-threads";

const THREADS_KEY = ["ai-threads"] as const;
const OFFLINE = "You're offline. Chats can be changed once you're back online.";

const fetchThread = (id: string) => unwrap(api.ai.threads[":id"].$get({ param: { id } }));

const fetchThreads = () => unwrap(api.ai.threads.$get());
type ServerThreads = Awaited<ReturnType<typeof fetchThreads>>;

/** Puts a row back in (or takes it out of) the cached server list, at once. */
function editList(change: (threads: ServerThreads) => ServerThreads) {
  queryClient.setQueryData<ServerThreads>(THREADS_KEY, (threads) => threads && change(threads));
}

/**
 * The open chat, refreshed from the server when online, and the chat list: open,
 * start, rename and delete (with Undo). `busy` while Tiki is answering, when the
 * chat must not change under the reply.
 */
export function useChatThreads(busy: boolean) {
  const online = useIsOnline();
  const threadId = useStore(threadIdStore);
  const local = useStore(localThreadsStore);
  const list = useQuery({ queryKey: THREADS_KEY, queryFn: fetchThreads, enabled: online });

  // Messages written on another device since this phone last looked.
  useEffect(() => {
    if (!online || busy || !threadId) return;
    if (!chatStore.get().some((message) => message.serverId)) return;
    let stale = false;
    fetchThread(threadId)
      .then((thread) => {
        if (stale || threadIdStore.get() !== threadId) return;
        const shown = chatStore.get();
        const merged = mergeThread(shown, thread.messages);
        const changed =
          merged.length !== shown.length ||
          merged.some((message, i) => message.rating !== shown[i]?.rating);
        if (changed) replaceMessages(merged);
      })
      // Deleted elsewhere, or unreachable: the phone's copy stands.
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [online, busy, threadId]);

  const rows: ThreadRow[] = threadList(list.data, local);

  const open = async (id: string) => {
    if (busy || id === threadIdStore.get()) return;
    const kept = await readLocalThread(id);
    if (online) {
      try {
        const thread = await fetchThread(id);
        switchThread(id, mergeThread(kept ?? [], thread.messages));
        haptic.tap();
        return;
      } catch (error) {
        if (!kept) return notify(friendlyError(error));
      }
    }
    if (!kept) return notify("This chat isn't kept on this phone. Open it when you're online.");
    switchThread(id, kept);
    haptic.tap();
  };

  const start = () => {
    if (busy) return;
    if (chatStore.get().length) newChat();
    haptic.tap();
  };

  const rename = async (row: ThreadRow, title: string) => {
    const name = title.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name || name === row.title) return;
    if (!online) return notify(OFFLINE);
    editList((threads) => threads.map((t) => (t.id === row.id ? { ...t, title: name } : t)));
    try {
      await unwrap(api.ai.threads[":id"].$patch({ param: { id: row.id }, json: { title: name } }));
    } catch (error) {
      notify(friendlyError(error));
    }
    void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
  };

  const remove = async (row: ThreadRow) => {
    if (busy) return;
    if (!row.local && !online) return notify(OFFLINE);
    const messages: ChatMessage[] = (await readLocalThread(row.id)) ?? [];
    const wasOpen = row.id === threadIdStore.get();
    if (!row.local) {
      try {
        await unwrap(api.ai.threads[":id"].$delete({ param: { id: row.id } }));
      } catch (error) {
        // Already gone on the server is gone all the same.
        if (!(error instanceof ApiError && error.status === 404))
          return notify(friendlyError(error));
      }
      editList((threads) => threads.filter((t) => t.id !== row.id));
    }
    forgetThread(row.id);
    if (wasOpen) newChat();
    haptic.tap();
    notify(`Deleted “${row.title}”`, {
      label: "Undo",
      onPress: () => void restore(row, messages, wasOpen),
    });
  };

  const restore = async (row: ThreadRow, messages: ChatMessage[], wasOpen: boolean) => {
    if (!row.local) {
      try {
        await unwrap(api.ai.threads[":id"].restore.$post({ param: { id: row.id } }));
      } catch (error) {
        return notify(friendlyError(error));
      }
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    }
    // Back as it was: reopened if nothing has been written in the new chat since.
    if (wasOpen && chatStore.get().length === 0 && !busy) switchThread(row.id, messages);
    else if (messages.length) keepThread(row.id, messages);
  };

  return {
    threadId,
    rows,
    loading: online && list.isPending && rows.length === 0,
    /** Offline: the list is the last one fetched, plus the chats kept on this phone. */
    offline: !online,
    open,
    start,
    rename,
    remove,
  };
}
