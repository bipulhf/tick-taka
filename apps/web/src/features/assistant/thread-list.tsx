import { MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { SkeletonRows } from "@/components/ui/skeleton";
import { inputClass } from "@/components/ui/text-field";
import { formatWhen, plural } from "@/lib/format";
import { useUserTime } from "@/lib/use-today";
import { deleteThread, renameThread, type ThreadSummary, useThreads } from "./threads";

const TITLE_LENGTH = 60;

/** A chat's name, edited in place: Enter or leaving the field saves, Escape keeps the old one. */
function RenameRow({ thread, onDone }: { thread: ThreadSummary; onDone: () => void }) {
  const [title, setTitle] = useState(thread.title);
  const save = () => {
    const next = title.trim();
    if (next && next !== thread.title) void renameThread(thread.id, next);
    onDone();
  };
  return (
    <div className="flex min-h-[52px] items-center px-3 py-2">
      <input
        // biome-ignore lint/a11y/noAutofocus: opened by choosing Rename, to type into.
        autoFocus
        value={title}
        maxLength={TITLE_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onDone();
          }
        }}
        aria-label="Chat name"
        className={`${inputClass} h-9`}
      />
    </div>
  );
}

/**
 * Chats with Tiki kept on the server, newest first: start a new one, open one, or
 * rename or delete it (with Undo).
 */
export function ThreadList({
  currentId,
  busy,
  onOpen,
  onNew,
}: {
  currentId: string | null;
  /** Tiki is still answering: switching waits until it's done. */
  busy: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const threads = useThreads(true);
  const { timeZone } = useUserTime();
  const [renaming, setRenaming] = useState<string | null>(null);
  const list = threads.data ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4">
      <Button icon={MessageSquarePlus} onClick={onNew} disabled={busy} className="self-start">
        New chat
      </Button>
      {!threads.data ? (
        threads.isError ? (
          <ErrorState onRetry={() => void threads.refetch()} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : list.length === 0 ? (
        <p className="px-1 text-callout text-muted">
          No chats yet. Each chat with Tiki is kept here, on every device you sign in on.
        </p>
      ) : (
        <Group as="ul" label="Your chats">
          {list.map((thread) =>
            renaming === thread.id ? (
              <li key={thread.id}>
                <RenameRow thread={thread} onDone={() => setRenaming(null)} />
              </li>
            ) : (
              <Row
                key={thread.id}
                as="li"
                selected={thread.id === currentId}
                onClick={busy ? undefined : () => onOpen(thread.id)}
                title={thread.title}
                subtitle={`${formatWhen(thread.updatedAt, true, Date.now(), timeZone)} · ${plural(thread.messageCount, "message")}`}
                trailing={
                  <Menu
                    items={[
                      { label: "Rename", icon: Pencil, onSelect: () => setRenaming(thread.id) },
                      "separator",
                      {
                        label: "Delete",
                        icon: Trash2,
                        danger: true,
                        onSelect: () => void deleteThread(thread.id, thread.title),
                      },
                    ]}
                    trigger={
                      <IconButton
                        icon={MoreHorizontal}
                        label={`More for “${thread.title}”`}
                        size="sm"
                        tooltip={false}
                      />
                    }
                  />
                }
              />
            ),
          )}
        </Group>
      )}
    </div>
  );
}
