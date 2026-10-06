import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { useColors } from "@/theme/colors";
import type { ChatAction, ChatMessage, ChatStep } from "./chat-store";
import { StreamingCaret, ThinkingIndicator } from "./thinking-indicator";
import type { LiveTurn } from "./use-assistant";

/** What changed in one turn, one row each, with its own Undo. */
function ActionList({
  actions,
  onUndo,
}: {
  actions: ChatAction[];
  onUndo?: (index: number) => void;
}) {
  return (
    <View className="w-full rounded-2xl border border-line px-3">
      {actions.map((action, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: a turn's actions never reorder, and two can share a summary.
          key={`${action.summary}-${index}`}
          className={`min-h-11 flex-row items-center gap-2.5 py-2.5 ${index > 0 ? "border-t border-line" : ""}`}
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
          {onUndo && action.undo && !action.undone ? (
            <Pressable
              onPress={() => onUndo(index)}
              accessibilityRole="button"
              accessibilityLabel={`Undo: ${action.summary}`}
              hitSlop={8}
              className="min-h-11 justify-center pl-2"
            >
              <Text variant="callout" tone="sky" className="font-nunito-bold">
                Undo
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Tiki's working steps: a spinner while one runs, then a tick or a cross. */
function StepList({ steps }: { steps: ChatStep[] }) {
  const colors = useColors();
  return (
    <View className="gap-1.5">
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps only ever append, and can repeat.
        <View key={`${step.text}-${index}`} className="flex-row items-start gap-2">
          <View className="h-[18px] w-4 items-center justify-center">
            {step.ok === undefined ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Icon
                name={step.ok ? "check" : "close"}
                size={16}
                color={step.ok ? "mint" : "coral"}
              />
            )}
          </View>
          <Text variant="caption" tone="muted" className="flex-1">
            {step.text}
            {step.ok === false ? " · didn't work" : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A finished turn's steps, folded away until asked for. */
function StepsFold({ steps }: { steps: ChatStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="w-full gap-2">
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        className="min-h-8 flex-row items-center gap-1 self-start px-1"
      >
        <Icon name="playlist-check" size={16} color="muted" />
        <Text variant="caption" tone="muted">
          {plural(steps.length, "step")}
        </Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color="muted" />
      </Pressable>
      {open ? (
        <View className="rounded-2xl bg-card/60 px-4 py-3">
          <StepList steps={steps} />
        </View>
      ) : null}
    </View>
  );
}

/** Tiki asked to delete these. Nothing is deleted until the user taps Delete. */
function DeletionCard({
  message,
  onConfirm,
  onKeep,
}: {
  message: ChatMessage;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const items = message.deletions ?? [];
  const count = items.length === 1 ? "this" : `these ${items.length}`;
  return (
    <View className="w-full gap-3 rounded-2xl border border-coral/40 bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="trash-can-outline" size={20} color="coral" />
        <Text variant="strong" className="flex-1">
          Delete {count}?
        </Text>
      </View>
      <View>
        {items.slice(0, 12).map((item) => (
          <Text key={item.path} variant="callout" className="py-0.5">
            • {item.summary}
          </Text>
        ))}
        {items.length > 12 ? (
          <Text variant="callout" tone="muted" className="py-0.5">
            and {items.length - 12} more
          </Text>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onKeep}
          accessibilityRole="button"
          className="h-11 flex-1 items-center justify-center rounded-full border border-line-strong active:bg-line/40"
        >
          <Text variant="callout" className="font-nunito-bold">
            Keep
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${items.length === 1 ? "it" : `all ${items.length}`}`}
          className="h-11 flex-1 items-center justify-center rounded-full bg-coral active:opacity-80"
        >
          <Text variant="callout" tone="onAccent" className="font-nunito-bold">
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One chat turn; Tiki's turns list what changed and ask before deleting anything. */
export function MessageBubble({
  message,
  onUndo,
  onConfirmDeletions,
  onKeep,
}: {
  message: ChatMessage;
  onUndo: (index: number) => void;
  onConfirmDeletions: () => void;
  onKeep: () => void;
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
    <View className="w-[90%] items-start gap-2 self-start">
      {message.steps?.length ? <StepsFold steps={message.steps} /> : null}
      <View className="rounded-3xl rounded-bl-lg bg-card px-4 py-3">
        <Text tone={message.failed ? "muted" : "ink"} selectable>
          {message.content}
        </Text>
      </View>
      {message.actions?.length ? <ActionList actions={message.actions} onUndo={onUndo} /> : null}
      {message.deletionChoice === "pending" ? (
        <DeletionCard message={message} onConfirm={onConfirmDeletions} onKeep={onKeep} />
      ) : message.deletionChoice === "kept" ? (
        <Text variant="caption" tone="muted" className="px-1">
          Kept everything. Nothing was deleted.
        </Text>
      ) : null}
    </View>
  );
}

/** Tiki at work: each step as it happens, then the reply as it streams in. */
export function LiveBubble({ turn }: { turn: LiveTurn }) {
  return (
    <View className="w-[90%] items-start gap-2 self-start">
      {turn.steps.length ? (
        <View className="w-full rounded-2xl bg-card/60 px-4 py-3">
          <StepList steps={turn.steps} />
        </View>
      ) : null}
      {turn.actions.length ? <ActionList actions={turn.actions} /> : null}
      <View className="rounded-3xl rounded-bl-lg bg-card px-4 py-3">
        {turn.text ? (
          <Text>
            {turn.text}
            <StreamingCaret />
          </Text>
        ) : (
          <ThinkingIndicator working={turn.steps.length > 0} />
        )}
      </View>
    </View>
  );
}
