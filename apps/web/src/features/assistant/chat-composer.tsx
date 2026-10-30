import { ArrowUp, Check, Mic, X } from "lucide-react";
import { forwardRef, type ReactNode, useImperativeHandle, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { inputClass } from "@/components/ui/text-field";
import { Tooltip } from "@/components/ui/tooltip";
import { useVoiceInput } from "./use-voice-input";

function RoundButton({
  icon,
  label,
  onClick,
  variant,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant: "primary" | "plain" | "stop";
  disabled?: boolean;
}) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cx(
          "flex size-10 shrink-0 items-center justify-center rounded-full transition-[filter,background-color] disabled:opacity-40",
          variant === "primary" && "bg-mango text-on-mango hover:brightness-[1.04]",
          variant === "plain" && "border border-line-strong bg-card text-ink hover:bg-line/40",
          variant === "stop" && "bg-coral text-on-mango hover:brightness-[1.04]",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

export interface ChatComposerHandle {
  focus: () => void;
}

/**
 * Type or talk. Speech becomes editable text first, so a misheard word never gets
 * sent. Enter sends; Shift+Enter starts a new line.
 */
export const ChatComposer = forwardRef<
  ChatComposerHandle,
  { onSend: (text: string) => void; busy: boolean }
>(function ChatComposer({ onSend, busy }, ref) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  const voice = useVoiceInput((heard) => {
    setText((current) => (current.trim() ? `${current.trim()} ${heard}` : heard));
    requestAnimationFrame(() => input.current?.focus());
  });

  const send = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };

  if (voice.state !== "idle") {
    const recording = voice.state === "recording";
    return (
      <div className="flex items-center gap-2" aria-live="polite">
        {recording ? (
          <RoundButton
            icon={<X aria-hidden className="size-5" />}
            label="Cancel recording"
            onClick={voice.cancel}
            variant="plain"
          />
        ) : null}
        <div className="flex min-h-10 flex-1 items-center gap-3 rounded-3xl bg-card px-4">
          {recording ? (
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-coral" />
          ) : (
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-transparent"
            />
          )}
          <span className="text-callout text-muted tabular">
            {recording
              ? `Listening… ${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}`
              : "Writing it down…"}
          </span>
        </div>
        {recording ? (
          <RoundButton
            icon={<Check aria-hidden className="size-5" strokeWidth={2.6} />}
            label="Done talking"
            onClick={voice.stop}
            variant="stop"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={input}
        value={text}
        rows={1}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        placeholder="Message Tiki…"
        aria-label="Message"
        className={cx(
          inputClass,
          "field-sizing-content max-h-40 min-h-10 resize-none rounded-3xl px-4 py-2",
        )}
      />
      {text.trim() || !voice.available ? (
        <RoundButton
          icon={<ArrowUp aria-hidden className="size-5" strokeWidth={2.6} />}
          label="Send"
          onClick={send}
          variant="primary"
          disabled={busy || !text.trim()}
        />
      ) : (
        <RoundButton
          icon={<Mic aria-hidden className="size-5" />}
          label="Talk"
          onClick={voice.start}
          variant="plain"
        />
      )}
    </div>
  );
});
