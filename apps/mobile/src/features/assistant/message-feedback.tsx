import type { AssistantRating } from "@tick-taka/shared/schemas/ai";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useColors } from "@/theme/colors";

function Thumb({
  rating,
  chosen,
  onPress,
}: {
  rating: AssistantRating;
  chosen: boolean;
  onPress: () => void;
}) {
  const up = rating === "up";
  const name = up
    ? chosen
      ? "thumb-up"
      : "thumb-up-outline"
    : chosen
      ? "thumb-down"
      : "thumb-down-outline";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={up ? "Good answer" : "Not a good answer"}
      accessibilityState={{ selected: chosen }}
      className="h-12 w-12 items-center justify-center rounded-full active:bg-line/40"
    >
      <Icon name={name} size={18} color={chosen ? "ink" : "muted"} />
    </Pressable>
  );
}

/**
 * Thumbs up or down under one of Tiki's stored replies. Down offers a one-line
 * comment, which is optional: the thumb itself is already sent.
 */
export function MessageFeedback({
  rating,
  onRate,
}: {
  rating?: AssistantRating;
  onRate: (rating: AssistantRating, comment?: string) => void;
}) {
  const colors = useColors();
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const sendComment = () => {
    if (comment.trim()) onRate("down", comment.trim().slice(0, 500));
    setAsking(false);
    setComment("");
  };
  return (
    <View className="w-full">
      <View className="-ml-3 flex-row">
        <Thumb rating="up" chosen={rating === "up"} onPress={() => onRate("up")} />
        <Thumb
          rating="down"
          chosen={rating === "down"}
          onPress={() => {
            if (rating !== "down") onRate("down");
            setAsking(true);
          }}
        />
      </View>
      {asking ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="What went wrong? (optional)"
            placeholderTextColor={colors.muted}
            maxLength={500}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendComment}
            accessibilityLabel="What went wrong (optional)"
            className="min-h-12 flex-1 rounded-2xl border border-line-strong bg-card px-4 font-nunito text-[15px] text-ink"
          />
          <Pressable
            onPress={sendComment}
            accessibilityRole="button"
            accessibilityLabel={comment.trim() ? "Send comment" : "Close comment"}
            className="min-h-12 justify-center px-2"
          >
            <Text variant="callout" tone="sky" className="font-nunito-bold">
              {comment.trim() ? "Send" : "Skip"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
