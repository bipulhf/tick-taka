import { useNavigate, useRouterState } from "@tanstack/react-router";
import { History, MessageCircle, MessageSquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { useIsDesk } from "@/components/ui/use-media";
import { parsePanel, usePanelSearch } from "@/lib/panel";
import { useAiStatus } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { assistantOpenStore } from "@/lib/ui-state";
import { type AboutRecord, aboutStore, composerFocusStore, pendingAskStore } from "./ask-tiki";
import { ChatComposer, type ChatComposerHandle } from "./chat-composer";
import { ChatWelcome } from "./chat-welcome";
import { clearChatWarning } from "./clear-chat-warning";
import { threadIdStore } from "./current-thread";
import { LiveBubble, MessageBubble } from "./message-bubble";
import { openQuestionId } from "./question-form";
import { screenFor } from "./screen";
import { ThreadList } from "./thread-list";
import { openThread, refreshCurrentThread } from "./threads";
import { useAssistant } from "./use-assistant";

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

/** A question waiting for a yes before the chat on screen is left. */
interface Leaving {
  warning: string;
  label: string;
  go: () => void;
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
    rate,
    clear,
    thinking,
  } = useAssistant();
  const composer = useRef<ChatComposerHandle>(null);
  const list = useRef<HTMLElement>(null);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [showThreads, setShowThreads] = useState(false);
  const threadId = useStore(threadIdStore);
  const about = useStore(aboutStore);
  const pending = useStore(pendingAskStore);
  const focusAsked = useStore(composerFocusStore);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { panel } = usePanelSearch();
  const screen = screenFor(pathname, parsePanel(panel), about);
  const send = (text: string) => void ask(text, screen);

  // biome-ignore lint/correctness/useExhaustiveDependencies: asked to focus (opened, or "Ask Tiki about this").
  useEffect(() => {
    setShowThreads(false);
    // After a menu that asked has closed and handed focus back to its trigger.
    const timer = setTimeout(() => composer.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [focusAsked]);
  // Replies sent to this chat from another device, picked up when it opens.
  useEffect(() => void refreshCurrentThread(), []);
  // A message typed in the palette: send it once the chat is free.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sends with the screen as it is now.
  useEffect(() => {
    if (!pending || thinking) return;
    pendingAskStore.set(null);
    setShowThreads(false);
    send(pending);
  }, [pending, thinking]);
  // Keep the newest message in view as it streams in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls whenever the chat grows.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, live, showThreads]);
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant");
  // Only the newest reply's question can be answered; any later message answers it.
  const openQuestion = openQuestionId(messages);
  const answer = (text: string) => {
    send(text);
    // The form goes away with the answer; the composer takes the focus it had.
    requestAnimationFrame(() => composer.current?.focus());
  };

  /** Leaves the chat on screen, asking first when Undo or an answer would be lost. */
  const leave = (label: string, go: () => void) => {
    const warning = clearChatWarning(messages);
    if (warning) setLeaving({ warning, label, go });
    else go();
  };
  const newChat = () =>
    leave("New chat", () => {
      clear();
      setShowThreads(false);
      requestAnimationFrame(() => composer.current?.focus());
    });
  const switchTo = (id: string) => {
    if (id === threadId) return setShowThreads(false);
    leave("Open it", () => {
      setShowThreads(false);
      void openThread(id);
    });
  };

  return (
    <>
      <Header
        onNewChat={messages.length && !thinking ? newChat : undefined}
        onThreads={() => setShowThreads(!showThreads)}
        showingThreads={showThreads}
        thinking={thinking}
      />
      {leaving ? (
        <div
          role="alertdialog"
          aria-label="Leave this chat?"
          className="flex flex-col gap-2 border-b border-line px-5 py-3"
        >
          <p className="text-callout font-bold">Leave this chat?</p>
          <p className="text-callout text-muted">{leaving.warning}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setLeaving(null)}>
              Stay here
            </Button>
            <Button
              size="sm"
              onClick={() => {
                leaving.go();
                setLeaving(null);
              }}
            >
              {leaving.label}
            </Button>
          </div>
        </div>
      ) : null}
      {showThreads ? (
        <ThreadList currentId={threadId} busy={thinking} onOpen={switchTo} onNew={newChat} />
      ) : (
        <>
          <section
            ref={list}
            aria-busy={thinking}
            aria-label="Chat with Tiki"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-2 pb-4"
          >
            {messages.length === 0 ? <ChatWelcome view={screen.view} onAsk={send} /> : null}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onUndo={(index) => undo(message.id, index)}
                onConfirmDeletions={() => confirmDeletions(message.id)}
                onKeep={() => keepAll(message.id)}
                onSaveDraft={(index) => saveDraft(message.id, index)}
                onDiscardDraft={(index) => discardDraft(message.id, index)}
                onRate={(rating, comment) => rate(message.id, rating, comment)}
                answering={
                  message.id === openQuestion ? { busy: thinking, onAnswer: answer } : undefined
                }
              />
            ))}
            {live ? <LiveBubble turn={live} /> : null}
          </section>
          {/* Tiki's finished replies, read once each; the stream itself stays quiet. */}
          <p className="sr-only" aria-live="polite">
            {lastReply && !thinking ? lastReply.content : ""}
          </p>
          <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4">
            {about ? <AboutChip about={about} /> : null}
            <ChatComposer ref={composer} onSend={send} busy={thinking} />
          </div>
        </>
      )}
    </>
  );
}

/** The record "this" means while asking about it, with a way to stop. */
function AboutChip({ about }: { about: AboutRecord }) {
  return (
    <div className="flex min-h-8 items-center gap-1 self-start rounded-full border border-line bg-card pr-1 pl-3">
      <span className="max-w-64 truncate text-caption">About “{about.title}”</span>
      <IconButton
        icon={X}
        size="sm"
        label={`Stop asking about “${about.title}”`}
        className="size-7"
        onClick={() => aboutStore.set(null)}
      />
    </div>
  );
}

function Header({
  onNewChat,
  onThreads,
  showingThreads = false,
  thinking,
}: {
  onNewChat?: () => void;
  onThreads?: () => void;
  showingThreads?: boolean;
  thinking: boolean;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pt-3 pb-2">
      <Tiki mood={thinking ? "focused" : "happy"} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="text-heading">{showingThreads ? "Your chats" : "Tiki"}</h2>
        <p className="truncate text-caption text-muted">
          {showingThreads ? "Kept on every device you use" : "Type or talk, in Bangla or English"}
        </p>
      </div>
      {onThreads ? (
        <IconButton
          icon={showingThreads ? MessageCircle : History}
          label={showingThreads ? "Back to the chat" : "Your chats"}
          onClick={onThreads}
        />
      ) : null}
      {onNewChat && !showingThreads ? (
        <IconButton icon={MessageSquarePlus} label="Start a new chat" onClick={onNewChat} />
      ) : null}
      <IconButton icon={X} label="Close chat" shortcut="Ctrl J" onClick={close} />
    </header>
  );
}

/**
 * Tiki's chat as a floating window above its launcher at the bottom right (the page
 * stays visible and usable behind it, so changes can be watched landing), and a
 * full-screen layer on a phone.
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
      className="fixed right-6 bottom-28 z-30 flex h-[min(640px,calc(100dvh-9rem))] w-[400px] animate-sheet-in flex-col overflow-hidden rounded-3xl border-2 border-ink/90 bg-chrome shadow-[6px_8px_0_rgb(35_32_43/0.9)]"
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
