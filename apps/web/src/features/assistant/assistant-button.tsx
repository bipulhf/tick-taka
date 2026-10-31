import { MessagesSquare, X } from "lucide-react";
import { useEffect } from "react";
import { registerPaletteActions } from "@/components/shell/command-palette";
import { Tiki } from "@/components/tiki/tiki";
import { cx } from "@/components/ui/cx";
import { useAiStatus } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { assistantOpenStore } from "@/lib/ui-state";

/** Whether the chat is available: the server has AI and the chat is switched on. */
export function useAssistantAvailable(): boolean {
  const { data: ai } = useAiStatus();
  return Boolean(ai?.configured && ai.features.assistant);
}

/**
 * Tiki's chat launcher: a round button floating at the bottom right of every page (above
 * the tab bar on a phone), like a support chat. Hidden when the chat could only say it
 * isn't available.
 */
export function AssistantButton() {
  const available = useAssistantAvailable();
  const open = useStore(assistantOpenStore);
  if (!available) return null;
  return (
    <button
      type="button"
      data-tour="tiki"
      aria-label={open ? "Close chat with Tiki" : "Chat with Tiki"}
      aria-expanded={open}
      title={open ? "Close chat (Ctrl J)" : "Chat with Tiki (Ctrl J)"}
      onClick={() => assistantOpenStore.set(!open)}
      className={cx(
        "group/tiki fixed right-4 bottom-24 z-30 flex size-16 items-center justify-center rounded-full border-2 border-ink/90 bg-mango shadow-[4px_5px_0_rgb(35_32_43/0.9)] transition-transform duration-200 ease-out-quart hover:-translate-y-0.5 hover:scale-105 active:translate-y-0.5 sm:right-6 sm:bottom-6",
        open && "bg-card",
      )}
    >
      {open ? (
        <X aria-hidden className="size-7 text-ink" strokeWidth={2.4} />
      ) : (
        <>
          <Tiki mood="happy" size={50} />
          <span
            aria-hidden
            className="pointer-events-none absolute right-full mr-3 hidden rounded-full border-2 border-ink/90 bg-card px-3 py-1 text-callout font-extrabold whitespace-nowrap text-ink opacity-0 shadow-[3px_3px_0_rgb(35_32_43/0.9)] transition-opacity duration-150 group-hover/tiki:opacity-100 sm:block"
          >
            Ask Tiki
          </span>
        </>
      )}
    </button>
  );
}

/** Adds "Chat with Tiki" to the command palette while the chat is available. */
export function AssistantPalette() {
  const available = useAssistantAvailable();
  useEffect(() => {
    if (!available) return;
    return registerPaletteActions(() => [
      {
        id: "assistant",
        label: "Chat with Tiki",
        group: "Actions",
        keywords: ["assistant", "ai", "ask", "talk"],
        icon: <MessagesSquare aria-hidden className="size-4 text-muted" />,
        run: () => assistantOpenStore.set(true),
      },
    ]);
  }, [available]);
  return null;
}
