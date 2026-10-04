import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from "@/components/navigation/tab-bar";
import { Tiki } from "@/components/tiki/tiki";
import { Icon } from "@/components/ui/icon";
import { haptic } from "@/lib/haptics";
import { useAiStatus } from "@/lib/queries";

/** Floating chat bubble in the bottom-left corner of every tab. */
export function AssistantButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: ai } = useAiStatus();
  if (!ai?.configured || !ai.features.assistant) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push("/assistant");
      }}
      accessibilityRole="button"
      accessibilityLabel="Chat with Tiki"
      className="absolute left-5 h-14 w-14 items-center justify-center rounded-full border border-line bg-card active:scale-95"
      style={{ bottom: insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + 12, elevation: 6 }}
    >
      <Tiki mood="happy" size={40} />
      <View className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-ink">
        <Icon name="chat-processing" size={14} color="background" />
      </View>
    </Pressable>
  );
}
