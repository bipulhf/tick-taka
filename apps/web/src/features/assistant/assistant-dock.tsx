import { useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { useIsDesk } from "@/components/ui/use-media";
import { useAiStatus } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { assistantOpenStore } from "@/lib/ui-state";
import { ChatComposer, type ChatComposerHandle } from "./chat-composer";
import { clearChatWarning } from "./clear-chat-warning";
import { LiveBubble, MessageBubble } from "./message-bubble";
import { useAssistant } from "./use-assistant";

const SUGGESTIONS = [
  "আজ কী কী কাজ আছে?",
  "Spent 120 on rickshaw from cash",
  "কালকের সব কাজ পরশু সরিয়ে দাও",
  "How much did I spend on food this month?",
  "Add a habit: 8 glasses of water a day",
];

const close = () => assistantOpenStore.set(false);

/** The server has no AI, or the chat is off: one calm line instead of a chat that fails. */
function Unavailable({ configured }: { configured: boolean }) {
  const navigate = useNavigate();
  return configured ? (
    <EmptyState
      title="The chat is switched off"
      message="Turn on Chat with Tiki in Settings › Tiki and AI to talk to Tiki here."
      actionLabel="Open Settings"
      onAction={() => {
        close();
        void navigate({ to: "/settings", search: { section: "ai" } });
      }}
      mood="calm"
    />
  ) : (
    <EmptyState
      title="Tiki can't chat here yet"
      message="AI isn't set up on this server, so the chat can't answer. Everything else works as usual."
      mood="calm"
    />
  );
}

/** Chat with Tiki: add, change, delete or ask about anything, by typing or talking. */
function Chat() {
  const {
    messages,
    live,
    ask,
    undo,
    confirmDeletions,
    keepAll,
    saveDraft,
    discardDraft,
    clear,
    thinking,
  } = useAssistant();
  const composer = useRef<ChatComposerHandle>(null);
  const list = useRef<HTMLElement>(null);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  useEffect(() => composer.current?.focus(), []);
  // Keep the newest message in view as it streams in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls whenever the chat grows.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, live]);
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant");

  const newChat = () => {
    const warning = clearChatWarning(messages);
    if (warning) setConfirmClear(warning);
    else clear();
  };

  return (
    <>
      <Header onNewChat={messages.length && !thinking ? newChat : undefined} thinking={thinking} />
      {confirmClear ? (
        <div
          role="alertdialog"
          aria-label="Start a new chat?"
          className="flex flex-col gap-2 border-b border-line px-5 py-3"
        >
          <p className="text-callout font-bold">Start a new chat?</p>
          <p className="text-callout text-muted">{confirmClear}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(null)}>
              Keep chat
            </Button>
            <Button
              size="sm"
              onClick={() => {
                clear();
                setConfirmClear(null);
              }}
            >
              New chat
            </Button>
          </div>
        </div>
      ) : null}
      <section
        ref={list}
        aria-busy={thinking}
        aria-label="Chat with Tiki"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-2 pb-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-body text-muted">
              Tell me what to add, change or delete, or ask about your day and money. Click the mic
              to talk.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Chip
                  key={suggestion}
                  onClick={() => void ask(suggestion)}
                  className="h-auto min-h-8 py-1 whitespace-normal text-left"
                >
                  {suggestion}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onUndo={(index) => undo(message.id, index)}
            onConfirmDeletions={() => confirmDeletions(message.id)}
            onKeep={() => keepAll(message.id)}
            onSaveDraft={(index) => saveDraft(message.id, index)}
            onDiscardDraft={(index) => discardDraft(message.id, index)}
          />
        ))}
        {live ? <LiveBubble turn={live} /> : null}
      </section>
      {/* Tiki's finished replies, read once each; the stream itself stays quiet. */}
      <p className="sr-only" aria-live="polite">
        {lastReply && !thinking ? lastReply.content : ""}
      </p>
      <div className="border-t border-line px-4 pt-3 pb-4">
        <ChatComposer ref={composer} onSend={(text) => void ask(text)} busy={thinking} />
      </div>
    </>
  );
}

function Header({ onNewChat, thinking }: { onNewChat?: () => void; thinking: boolean }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-3 pb-2">
      <Tiki mood={thinking ? "focused" : "happy"} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="text-heading">Tiki</h2>
        <p className="text-caption text-muted">Type or talk, in Bangla or English</p>
      </div>
      {onNewChat ? (
        <IconButton icon={MessageSquarePlus} label="Start a new chat" onClick={onNewChat} />
      ) : null}
      <IconButton icon={X} label="Close chat" shortcut="Ctrl J" onClick={close} />
    </header>
  );
}

/**
 * Tiki's chat beside the content on a wide screen (a 400 px column, so changes can be
 * watched landing in the list next to it), and a full-screen layer below that.
 */
export function AssistantDock() {
  const open = useStore(assistantOpenStore);
  const desk = useIsDesk();
  const { data: ai } = useAiStatus();
  const available = Boolean(ai?.configured && ai.features.assistant);
  const dock = useRef<HTMLElement>(null);

  // Escape inside the chat closes it, unless a menu or tooltip inside takes it first.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!desk || dock.current?.contains(document.activeElement)) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, desk]);

  if (!open) return null;
  const body = !ai ? null : available ? (
    <Chat />
  ) : (
    <>
      <Header thinking={false} />
      <div className="flex flex-1 items-center justify-center px-6">
        <Unavailable configured={ai.configured} />
      </div>
    </>
  );
  return desk ? (
    <aside
      ref={dock}
      aria-label="Chat with Tiki"
      className="flex w-[400px] shrink-0 animate-fade-in flex-col border-l border-line bg-chrome"
    >
      {body}
    </aside>
  ) : (
    <section
      ref={dock}
      role="dialog"
      aria-modal="true"
      aria-label="Chat with Tiki"
      className={cx("fixed inset-0 z-40 flex animate-sheet-in flex-col bg-background")}
    >
      {body}
    </section>
  );
}
