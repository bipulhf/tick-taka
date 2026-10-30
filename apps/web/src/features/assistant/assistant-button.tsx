import { MessagesSquare } from "lucide-react";
import { useEffect } from "react";
import { registerPaletteActions } from "@/components/shell/command-palette";
import { IconButton } from "@/components/ui/icon-button";
import { useAiStatus } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { assistantOpenStore } from "@/lib/ui-state";

/** Whether the chat is available: the server has AI and the chat is switched on. */
export function useAssistantAvailable(): boolean {
  const { data: ai } = useAiStatus();
  return Boolean(ai?.configured && ai.features.assistant);
}

/** The top bar's Tiki toggle; hidden when the chat could only say it isn't available. */
export function AssistantButton() {
  const available = useAssistantAvailable();
  const open = useStore(assistantOpenStore);
  if (!available) return null;
  return (
    <IconButton
      icon={MessagesSquare}
      label={open ? "Close chat with Tiki" : "Chat with Tiki"}
      shortcut="Ctrl J"
      pressed={open}
      onClick={() => assistantOpenStore.set(!open)}
    />
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
