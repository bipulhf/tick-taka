import type { AssistantRecordKind } from "@tick-taka/shared/schemas/ai";
import { createStore } from "@/lib/store";
import { assistantOpenStore } from "@/lib/ui-state";

/** A record picked with "Ask Tiki about this": "this" and "it" mean it until dropped. */
export interface AboutRecord {
  kind: AssistantRecordKind;
  id: string;
  title: string;
}

export const aboutStore = createStore<AboutRecord | null>(null);

/** A message to send as soon as the chat is open (typed in the palette). */
export const pendingAskStore = createStore<string | null>(null);

/** Bumped to ask the chat's composer to take focus. */
export const composerFocusStore = createStore(0);

/** Opens the chat and sends `text`. */
export function askTiki(text: string) {
  const content = text.trim();
  if (!content) return;
  pendingAskStore.set(content);
  assistantOpenStore.set(true);
}

/** Opens the chat about one record, with the composer ready for the question. */
export function askTikiAbout(record: AboutRecord) {
  aboutStore.set(record);
  assistantOpenStore.set(true);
  composerFocusStore.set(composerFocusStore.get() + 1);
}
