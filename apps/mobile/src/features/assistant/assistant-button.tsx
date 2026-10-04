import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Icon } from "@/components/ui/icon";
import { haptic } from "@/lib/haptics";
import { useAiStatus } from "@/lib/queries";

/** Whether the chat is available, so the tab bar can make room for its button. */
export function useAssistantAvailable(): boolean {
  const { data: ai } = useAiStatus();
  return Boolean(ai?.configured && ai.features.assistant);
}

/** Round Tiki button at the left end of the tab bar: one thumb-tap to the chat. */
export function AssistantButton({ size }: { size: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push("/assistant");
      }}
      accessibilityRole="button"
      accessibilityLabel="Chat with Tiki"
      className="items-center justify-center rounded-full border border-line bg-card active:scale-95"
      style={{ width: size, height: size, elevation: 10 }}
    >
      <Tiki mood="happy" size={size - 20} />
      <View className="absolute right-0 top-0 h-6 w-6 items-center justify-center rounded-full bg-ink">
        <Icon name="chat-processing" size={14} color="background" />
      </View>
    </Pressable>
  );
}
