import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Icon } from "@/components/ui/icon";
import { type RowAction, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatWhen, plural } from "@/lib/format";
import { useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { useColors } from "@/theme/colors";
import type { ThreadRow } from "./chat-threads";
import type { useChatThreads } from "./use-chat-threads";

type Threads = ReturnType<typeof useChatThreads>;

function RenameRow({
  row,
  onSave,
  onCancel,
}: {
  row: ThreadRow;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  return (
    <View className="gap-2 bg-card px-4 py-3">
      <TextField
        value={title}
        onChangeText={setTitle}
        maxLength={60}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => onSave(title)}
        accessibilityLabel="Chat name"
      />
      <View className="flex-row justify-end gap-2">
        <Button label="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        <Button
          label="Save"
          variant="secondary"
          size="sm"
          disabled={!title.trim()}
          onPress={() => onSave(title)}
        />
      </View>
    </View>
  );
}

/**
 * Every chat with Tiki, newest first, on every device: tap one to open it, swipe
 * left to rename or delete it (Undo brings it back).
 */
export function ChatList({ threads, onOpened }: { threads: Threads; onOpened: () => void }) {
  const colors = useColors();
  const { data: settings } = useSettings();
  const timeZone = userTime(settings).timeZone;
  const [renaming, setRenaming] = useState<string | null>(null);

  const rowActions = (row: ThreadRow): RowAction[] => [
    ...(row.local
      ? []
      : [
          {
            label: "Rename",
            icon: "pencil-outline",
            tone: "sky",
            onPress: () => setRenaming(row.id),
          } as const,
        ]),
    {
      label: "Delete",
      icon: "trash-can-outline",
      tone: "coral",
      onPress: () => threads.remove(row),
    },
  ];

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 px-5 pb-6 pt-1"
      keyboardShouldPersistTaps="handled"
    >
      <Button
        label="New chat"
        icon="plus"
        onPress={() => {
          threads.start();
          onOpened();
        }}
      />
      {threads.offline ? (
        <Text variant="caption" tone="muted" className="px-1">
          Offline. Chats kept on this phone can still be opened.
        </Text>
      ) : null}
      {threads.loading ? (
        <View className="py-6">
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : threads.rows.length === 0 ? (
        <EmptyState
          title="No chats yet"
          message="Your chats with Tiki show here, on every device you sign in on."
        />
      ) : (
        <Group>
          {threads.rows.map((row) =>
            renaming === row.id ? (
              <RenameRow
                key={row.id}
                row={row}
                onCancel={() => setRenaming(null)}
                onSave={(title) => {
                  setRenaming(null);
                  void threads.rename(row, title);
                }}
              />
            ) : (
              <SwipeRow key={row.id} rounded={false} actions={rowActions(row)}>
                <SwipeRowPressable
                  onPress={() => {
                    void threads.open(row.id).then(onOpened);
                  }}
                  accessibilityLabel={`${row.title}${row.id === threads.threadId ? ", open now" : ""}`}
                  className="min-h-[60px] flex-row items-center gap-3 bg-card px-4 py-3 active:bg-line/40"
                >
                  <View className="flex-1">
                    <Text variant="strong" numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text variant="callout" tone="muted" numberOfLines={1}>
                      {[
                        formatWhen(row.updatedAt, false, Date.now(), timeZone),
                        plural(row.messageCount, "message"),
                        row.local ? "only on this phone" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  {row.id === threads.threadId ? (
                    <Icon name="check" size={22} color="ink" />
                  ) : (
                    <Icon name="chevron-right" color="muted" />
                  )}
                </SwipeRowPressable>
              </SwipeRow>
            ),
          )}
        </Group>
      )}
      <Text variant="caption" tone="muted" className="px-1">
        Swipe left on a chat to rename or delete it. Chats are kept in your own space on the server,
        and deleting one removes it everywhere.
      </Text>
    </ScrollView>
  );
}
