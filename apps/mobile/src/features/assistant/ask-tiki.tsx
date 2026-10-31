import type { AssistantRecordKind, AssistantScreen } from "@tick-taka/shared/schemas/ai";
import { usePathname, useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { createStore } from "@/lib/store";
import { useAssistantAvailable } from "./assistant-button";
import { assistantHref } from "./assistant-screen";

/** How many chat screens are mounted, so a sheet opened from the chat goes back to it. */
export const assistantOpenStore = createStore(0);

/** A record to ask about in the chat that is already open, with a count so a repeat still lands. */
export const askAboutStore = createStore<{ screen: AssistantScreen; n: number } | null>(null);

/**
 * "Ask Tiki" in a record's sheet: opens the chat with that record as what the user
 * is looking at, so "this" and "it" mean it. Only shown when the chat is available.
 */
export function AskTikiButton({ kind, id }: { kind: AssistantRecordKind; id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const available = useAssistantAvailable();
  if (!available) return null;
  return (
    <Button
      label="Ask Tiki"
      icon="chat-processing-outline"
      variant="secondary"
      size="sm"
      className="self-start"
      onPress={() => {
        const screen: AssistantScreen = { view: pathname.slice(0, 120), record: { kind, id } };
        if (assistantOpenStore.get() > 0) {
          // The sheet sits on the chat (opened from a card): go back to it.
          askAboutStore.set({ screen, n: (askAboutStore.get()?.n ?? 0) + 1 });
          router.back();
        } else router.push(assistantHref(screen));
      }}
    />
  );
}
