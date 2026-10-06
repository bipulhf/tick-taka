import { useRouter } from "expo-router";
import { useRef } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tiki } from "@/components/tiki/tiki";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useKeyboardHeight } from "@/components/ui/use-keyboard-height";
import { ChatComposer } from "./chat-composer";
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

/** Chat with Tiki: add, change, delete or ask about anything, by typing or talking. */
export function AssistantSheet({ start }: { start?: "talk" }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboard = useKeyboardHeight();
  const scroll = useRef<ScrollView>(null);
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
            Tiki
          </Text>
          <Text variant="caption" tone="muted">
            Type or talk, in Bangla or English
          </Text>
        </View>
        {messages.length && !thinking ? (
          <IconButton
            icon="broom"
            label="Start a new chat"
            shape="round"
            color="muted"
            onPress={() => {
              const warning = clearChatWarning(messages);
              if (!warning) return clear();
              Alert.alert("Start a new chat?", warning, [
                { text: "Keep chat", style: "cancel" },
                { text: "New chat", onPress: clear },
              ]);
            }}
          />
        ) : null}
      </View>
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-4 pt-1"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View className="gap-4 pt-2">
            <Text tone="muted">
              Tell me what to add, change or delete, or ask about your day and money. Tap the mic to
              talk.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Chip key={suggestion} label={suggestion} onPress={() => void ask(suggestion)} />
              ))}
            </View>
          </View>
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
      </ScrollView>
      <View
        className="border-t border-line px-4 pt-3"
        style={{ paddingBottom: (keyboard ? 0 : insets.bottom) + 10 }}
      >
        <ChatComposer onSend={(text) => void ask(text)} busy={thinking} start={start} />
      </View>
    </View>
  );
}
