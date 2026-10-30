import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ListChecks,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { plural } from "@/lib/format";
import type { ChatAction, ChatMessage, ChatStep } from "./chat-store";
import { DraftCard } from "./draft-card";
import { StreamingCaret, ThinkingIndicator } from "./thinking-indicator";
import type { LiveTurn } from "./use-assistant";

/** What changed in one turn, one row each, with its own Undo. */
function ActionList({
  actions,
  onUndo,
}: {
  actions: ChatAction[];
  onUndo?: (index: number) => void;
}) {
  return (
    <ul className="w-full rounded-2xl border border-line px-3">
      {actions.map((action, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: a turn's actions never reorder, and two can share a summary.
          key={`${action.summary}-${index}`}
          className={cx(
            "flex min-h-10 items-center gap-2.5 py-2",
            index > 0 && "border-t border-line",
          )}
        >
          {action.undone ? (
            <Undo2 aria-hidden className="size-4 shrink-0 text-muted" />
          ) : (
            <CircleCheck aria-hidden className="size-4 shrink-0 text-mint-text" />
          )}
          <span
            className={cx(
              "flex-1 text-callout",
              action.undone && "text-muted line-through decoration-line-strong",
            )}
          >
            {action.summary}
            {action.undone ? <span className="sr-only"> (undone)</span> : null}
          </span>
          {onUndo && action.undo && !action.undone ? (
            <button
              type="button"
              onClick={() => onUndo(index)}
              aria-label={`Undo: ${action.summary}`}
              className="rounded-lg px-2 py-1 text-callout font-bold text-sky-text hover:bg-sky/10"
            >
              Undo
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Tiki's working steps: a spinner while one runs, then a tick or a cross. */
function StepList({ steps }: { steps: ChatStep[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps only ever append, and can repeat.
        <li key={`${step.text}-${index}`} className="flex items-start gap-2">
          <span className="flex h-[18px] w-4 shrink-0 items-center justify-center">
            {step.ok === undefined ? (
              <span
                aria-hidden
                className="size-3 animate-spin rounded-full border-2 border-muted border-t-transparent"
              />
            ) : step.ok ? (
              <Check aria-hidden className="size-4 text-mint-text" />
            ) : (
              <X aria-hidden className="size-4 text-coral-text" />
            )}
          </span>
          <span className="flex-1 text-caption text-muted">
            {step.text}
            {step.ok === false ? " · didn't work" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A finished turn's steps, folded away until asked for. */
function StepsFold({ steps }: { steps: ChatStep[] }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-7 items-center gap-1 self-start rounded-lg px-1 text-caption text-muted hover:text-ink"
      >
        <ListChecks aria-hidden className="size-4" />
        {plural(steps.length, "step")}
        <Chevron aria-hidden className="size-4" />
      </button>
      {open ? (
        <div className="rounded-2xl bg-card/60 px-4 py-3">
          <StepList steps={steps} />
        </div>
      ) : null}
    </div>
  );
}

/** Tiki asked to delete these. Nothing is deleted until the user clicks Delete. */
function DeletionCard({
  message,
  onConfirm,
  onKeep,
}: {
  message: ChatMessage;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const items = message.deletions ?? [];
  const count = items.length === 1 ? "this" : `these ${items.length}`;
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-line-strong bg-card p-4">
      <p className="flex items-center gap-2 text-body font-bold">
        <Trash2 aria-hidden className="size-[18px] text-coral-text" />
        Delete {count}?
      </p>
      <ul className="flex flex-col gap-0.5 text-callout">
        {items.slice(0, 12).map((item) => (
          <li key={item.path}>• {item.summary}</li>
        ))}
        {items.length > 12 ? <li className="text-muted">and {items.length - 12} more</li> : null}
      </ul>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onKeep}>
          Keep
        </Button>
        <Button
          className="flex-1 border border-coral-text/50"
          variant="danger"
          onClick={onConfirm}
          aria-label={`Delete ${items.length === 1 ? "it" : `all ${items.length}`}`}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * One chat turn; Tiki's turns list what changed, ask before deleting anything and
 * hold proposed money changes until Save.
 */
export function MessageBubble({
  message,
  onUndo,
  onConfirmDeletions,
  onKeep,
  onSaveDraft,
  onDiscardDraft,
}: {
  message: ChatMessage;
  onUndo: (index: number) => void;
  onConfirmDeletions: () => void;
  onKeep: () => void;
  onSaveDraft: (index: number) => void;
  onDiscardDraft: (index: number) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="max-w-[85%] self-end rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-body whitespace-pre-wrap text-background">
        <span className="sr-only">You: </span>
        {message.content}
      </div>
    );
  }
  return (
    <div className="flex w-[92%] flex-col items-start gap-2 self-start">
      {message.steps?.length ? <StepsFold steps={message.steps} /> : null}
      <div
        className={cx(
          "rounded-3xl rounded-bl-lg bg-card px-4 py-2.5 text-body whitespace-pre-wrap",
          message.failed && "text-muted",
        )}
      >
        <span className="sr-only">Tiki: </span>
        {message.content}
      </div>
      {message.actions?.length ? <ActionList actions={message.actions} onUndo={onUndo} /> : null}
      {message.drafts?.map((draft, index) => (
        <DraftCard
          // biome-ignore lint/suspicious/noArrayIndexKey: a turn's drafts never reorder.
          key={`${draft.path}-${index}`}
          draft={draft}
          onSave={() => onSaveDraft(index)}
          onDiscard={() => onDiscardDraft(index)}
        />
      ))}
      {message.deletionChoice === "pending" ? (
        <DeletionCard message={message} onConfirm={onConfirmDeletions} onKeep={onKeep} />
      ) : message.deletionChoice === "kept" ? (
        <p className="px-1 text-caption text-muted">Kept everything. Nothing was deleted.</p>
      ) : null}
    </div>
  );
}

/** Tiki at work: each step as it happens, then the reply as it streams in. */
export function LiveBubble({ turn }: { turn: LiveTurn }) {
  return (
    <div className="flex w-[92%] flex-col items-start gap-2 self-start">
      {turn.steps.length ? (
        <div className="w-full rounded-2xl bg-card/60 px-4 py-3">
          <StepList steps={turn.steps} />
        </div>
      ) : null}
      {turn.actions.length ? <ActionList actions={turn.actions} /> : null}
      <div className="rounded-3xl rounded-bl-lg bg-card px-4 py-2.5 text-body whitespace-pre-wrap">
        {turn.text ? (
          <>
            {turn.text}
            <StreamingCaret />
          </>
        ) : (
          <ThinkingIndicator working={turn.steps.length > 0} />
        )}
      </div>
    </div>
  );
}
