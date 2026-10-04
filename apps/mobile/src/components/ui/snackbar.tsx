import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { snackStore } from "@/lib/notify";
import { useStore } from "@/lib/store";
import { Text } from "./text";

const VISIBLE_MS = 5000;

export function Snackbar() {
  const snack = useStore(snackStore);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!snack) return;
    const timer = setTimeout(() => {
      if (snackStore.get()?.id === snack.id) snackStore.set(null);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [snack]);
  if (!snack) return null;
  return (
    <Animated.View
      key={snack.id}
      entering={FadeInDown.springify()}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 88 }}
    >
      <View
        className="flex-row items-center gap-3 rounded-2xl bg-ink px-4 py-3"
        accessibilityLiveRegion="polite"
      >
        <Text tone="background" className="flex-1" numberOfLines={2}>
          {snack.message}
        </Text>
        {snack.actionLabel ? (
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            className="min-h-10 justify-center"
            onPress={() => {
              snack.onAction?.();
              snackStore.set(null);
            }}
          >
            <Text variant="strong" tone="mango">
              {snack.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
