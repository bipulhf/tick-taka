import type { TikiMood } from "@tick-taka/shared/tiki";
import { View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "./button";
import { Text } from "./text";

/** Every empty state shows Tiki plus exactly one suggested action. */
export function EmptyState({
  message,
  actionLabel,
  onAction,
  mood = "curious",
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  mood?: TikiMood;
}) {
  return (
    <View className="items-center gap-3 py-6">
      <Tiki mood={mood} size={72} />
      <Text tone="muted" className="text-center">
        {message}
      </Text>
      <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
    </View>
  );
}
