import type { TikiMood } from "@tick-taka/shared/tiki";
import { Pressable, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { useIsOnline } from "@/lib/connection";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

/**
 * Nothing here yet: Tiki, a short title, one line on why it matters and, when
 * there is something useful to do, exactly one action. `icon` gives the compact
 * inline form for sections on busy screens like Today.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  mood = "curious",
  icon,
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  mood?: TikiMood;
  icon?: IconName;
}) {
  if (icon) {
    return (
      <Pressable
        onPress={onAction}
        disabled={!onAction}
        accessibilityRole={onAction ? "button" : undefined}
        className="min-h-[68px] flex-row items-center gap-3 rounded-3xl border border-dashed border-line px-4 py-3 active:bg-line/30"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-card">
          <Icon name={icon} size={22} color="muted" />
        </View>
        <View className="flex-1">
          {title ? <Text variant="strong">{title}</Text> : null}
          <Text variant="callout" tone="muted">
            {message}
          </Text>
        </View>
        {actionLabel && onAction ? (
          <Text variant="callout" tone="sky" className="font-nunito-bold">
            {actionLabel}
          </Text>
        ) : null}
      </Pressable>
    );
  }
  return (
    <View className="items-center gap-2 rounded-3xl px-6 py-8">
      <Tiki mood={mood} size={72} />
      {title ? (
        <Text variant="heading" className="mt-1 text-center">
          {title}
        </Text>
      ) : null}
      <Text tone="muted" className="text-center">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          className="mt-2"
        />
      ) : null}
    </View>
  );
}

/** Loading failed and there is nothing cached to show. */
export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const online = useIsOnline();
  if (!online)
    return (
      <EmptyState
        title="You're offline"
        message="This hasn't been opened on this phone yet. It loads by itself once you're back online."
        mood="calm"
      />
    );
  return (
    <EmptyState
      title="Couldn't load this"
      message={message ?? "Can't load this right now. Check your internet, then try again."}
      actionLabel="Try again"
      onAction={onRetry}
      mood="calm"
    />
  );
}
