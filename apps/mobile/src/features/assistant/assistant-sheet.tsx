import type { AssistantScreen } from "@tick-taka/shared/schemas/ai";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tiki } from "@/components/tiki/tiki";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useKeyboardHeight } from "@/components/ui/use-keyboard-height";
import { useStore } from "@/lib/store";
import { askAboutStore, assistantOpenStore } from "./ask-tiki";
import { ChatComposer } from "./chat-composer";
import { ChatIntro } from "./chat-intro";
import { ChatList } from "./chat-list";
import { asksToGoAhead } from "./chat-threads";
import { LiveBubble, MessageBubble } from "./message-bubble";
import { recordNoun } from "./message-cards";
import { useAssistant } from "./use-assistant";
import { useChatThreads } from "./use-chat-threads";

/**
 * Chat with Tiki: add, change, delete or ask about anything, by typing or talking.
 * `screen` is where it was opened from; the list of chats is one tap away.
 */
export function AssistantSheet({
  start,
  screen: openedFrom,
}: {
  start?: "talk";
  screen: AssistantScreen;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboard = useKeyboardHeight();
  const scroll = useRef<ScrollView>(null);
  const [screen, setScreen] = useState(openedFrom);
  const [showing, setShowing] = useState<"chat" | "chats">("chat");
  const askAbout = useStore(askAboutStore);
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
    newChat,
    thinking,
  } = useAssistant(screen);
  const threads = useChatThreads(thinking);

  // Sheets opened from here come back to this chat for "Ask Tiki".
  useEffect(() => {
    assistantOpenStore.set(assistantOpenStore.get() + 1);
    askAboutStore.set(null);
    return () => assistantOpenStore.set(assistantOpenStore.get() - 1);
  }, []);
  useEffect(() => {
    if (!askAbout) return;
    setScreen(askAbout.screen);
    setShowing("chat");
  }, [askAbout]);

  const last = messages.at(-1);
  // "I'll move 7 tasks to Friday. Go ahead?": a one-tap answer under the question.
  const goAhead =
    !thinking &&
    last?.role === "assistant" &&
    !last.failed &&
    last.deletionChoice !== "pending" &&
    !last.drafts?.some((draft) => draft.state === "pending") &&
    asksToGoAhead(last.content);
  const record = screen.record;

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: keyboard }}>
      <View
        className="flex-row items-center gap-3 px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <IconButton
          icon="chevron-down"
          label="Close chat"
          shape="round"
          iconSize={28}
          onPress={() => router.back()}
        />
        <Tiki mood={thinking ? "focused" : "happy"} size={44} />
        <View className="flex-1">
          <Text variant="title" accessibilityRole="header">
            {showing === "chats" ? "Chats" : "Tiki"}
          </Text>
          <Text variant="caption" tone="muted">
            {showing === "chats" ? "On every device you use" : "Type or talk, in Bangla or English"}
          </Text>
        </View>
        {showing === "chats" ? (
          <IconButton
            icon="arrow-left"
            label="Back to the chat"
            shape="round"
            color="muted"
            onPress={() => setShowing("chat")}
          />
        ) : !thinking ? (
          <>
            {messages.length ? (
              <IconButton
                icon="message-plus-outline"
                label="Start a new chat"
                shape="round"
                color="muted"
                onPress={newChat}
              />
            ) : null}
            <IconButton
              icon="forum-outline"
              label="Your chats"
              shape="round"
              color="muted"
              onPress={() => setShowing("chats")}
            />
          </>
        ) : null}
      </View>
      {showing === "chats" ? (
        <ChatList threads={threads} onOpened={() => setShowing("chat")} />
      ) : (
        <>
          <ScrollView
            ref={scroll}
            className="flex-1"
            contentContainerClassName="gap-3 px-5 pb-4 pt-1"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <ChatIntro view={screen.view} onAsk={(text) => void ask(text)} />
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
                onRate={(rating, comment) => rate(message.id, rating, comment)}
              />
            ))}
            {goAhead ? (
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="Yes, go ahead"
                  choice="action"
                  onPress={() => void ask("Yes, go ahead")}
                />
                <Chip
                  label="No, leave it"
                  choice="action"
                  onPress={() => void ask("No, leave it")}
                />
              </View>
            ) : null}
            {live ? <LiveBubble turn={live} /> : null}
          </ScrollView>
          <View
            className="gap-2 border-t border-line px-4 pt-1"
            style={{ paddingBottom: (keyboard ? 0 : insets.bottom) + 10 }}
          >
            {record ? (
              <View className="-mr-2 flex-row items-center gap-2 pl-1">
                <Icon name="eye-outline" size={18} color="muted" />
                <Text variant="caption" tone="muted" className="flex-1">
                  Asking about this {recordNoun(record.kind)}
                </Text>
                <IconButton
                  icon="close"
                  label={`Stop asking about this ${recordNoun(record.kind)}`}
                  color="muted"
                  iconSize={18}
                  onPress={() => setScreen({ view: screen.view })}
                />
              </View>
            ) : (
              <View className="h-2" />
            )}
            <ChatComposer
              onSend={(text) => void ask(text)}
              busy={thinking}
              start={start}
              focusKey={record ? `${record.id}-${askAbout?.n ?? 0}` : undefined}
            />
          </View>
        </>
      )}
    </View>
  );
}
