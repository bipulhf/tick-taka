import type { TikiMood } from "@tick-taka/shared/tiki";
import type { LucideIcon } from "lucide-react";
import { Tiki } from "@/components/tiki/tiki";
import { useIsOnline } from "@/lib/online";
import { Button } from "./button";

/**
 * Nothing here yet: Tiki, a short title, one line on why it matters and, when
 * there is something useful to do, exactly one action. `icon` gives the compact
 * inline form for sections on busy views like Today.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  mood = "curious",
  icon: Icon,
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  mood?: TikiMood;
  icon?: LucideIcon;
}) {
  if (Icon) {
    const content = (
      <>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
          <Icon aria-hidden className="size-[18px] text-muted" />
        </span>
        <span className="flex-1 text-left">
          {title ? <span className="block text-body font-bold">{title}</span> : null}
          <span className="block text-callout text-muted">{message}</span>
        </span>
        {actionLabel ? (
          <span className="text-callout font-bold text-sky-text">{actionLabel}</span>
        ) : null}
      </>
    );
    const className =
      "flex min-h-16 w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong/50 px-4 py-3";
    return onAction ? (
      <button type="button" onClick={onAction} className={`${className} hover:bg-line/30`}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Tiki mood={mood} size={72} />
      {title ? <h3 className="mt-1 text-heading">{title}</h3> : null}
      <p className="max-w-sm text-callout text-muted">{message}</p>
      {actionLabel && onAction ? (
        <Button size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Loading failed and there is nothing to show. */
export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const online = useIsOnline();
  if (!online)
    return (
      <EmptyState
        title="You're offline"
        message="This loads by itself once you're back online."
        mood="calm"
      />
    );
  return (
    <EmptyState
      title="Couldn't load this"
      message={message ?? "Can't load this right now. Check your internet, then try again."}
      actionLabel="Try again"
      onAction={onRetry}
      mood="calm"
    />
  );
}
