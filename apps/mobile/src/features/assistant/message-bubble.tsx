import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ChatMessage } from "./chat-store";

/** One chat turn; Tiki's turns list what changed, each with its own Undo. */
export function MessageBubble({
  message,
  onUndo,
}: {
  message: ChatMessage;
  onUndo: (index: number) => void;
}) {
  if (message.role === "user") {
    return (
      <View className="max-w-[85%] self-end rounded-3xl rounded-br-lg bg-ink px-4 py-3">
        <Text tone="background" selectable>
          {message.content}
        </Text>
      </View>
    );
  }
  return (
    <View className="max-w-[90%] gap-2 self-start">
      <View className="rounded-3xl rounded-bl-lg bg-card px-4 py-3">
        <Text tone={message.failed ? "muted" : "ink"} selectable>
          {message.content}
        </Text>
      </View>
      {message.actions?.length ? (
        <View className="rounded-2xl border border-line px-3 py-1">
          {message.actions.map((action, index) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: a turn's actions never reorder, and two can share a summary.
              key={`${action.summary}-${index}`}
              className="min-h-11 flex-row items-center gap-2"
            >
              <Icon
                name={action.undone ? "undo-variant" : "check-circle"}
                size={18}
                color={action.undone ? "muted" : "mint"}
              />
              <Text
                variant="callout"
                tone={action.undone ? "muted" : "ink"}
                className={`flex-1 ${action.undone ? "line-through" : ""}`}
              >
                {action.summary}
              </Text>
              {action.undo && !action.undone ? (
                <Pressable
                  onPress={() => onUndo(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Undo: ${action.summary}`}
                  hitSlop={8}
                  className="min-h-11 justify-center px-2"
                >
                  <Text variant="callout" tone="sky" className="font-nunito-bold">
                    Undo
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
