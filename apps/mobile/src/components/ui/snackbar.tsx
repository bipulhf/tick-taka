import { useEffect } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { snackLiftStore, snackStore } from "@/lib/notify";
import { snackAnnouncement, snackDuration, VISIBLE_MS, WITH_ACTION_MS } from "@/lib/snack-timing";
import { useStore } from "@/lib/store";
import { Text } from "./text";

export function Snackbar() {
  const snack = useStore(snackStore);
  const lift = useStore(snackLiftStore);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!snack) return;
    const hasAction = Boolean(snack.onAction);
    AccessibilityInfo.announceForAccessibility(snackAnnouncement(snack.message, snack.actionLabel));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void (async () => {
      const base = hasAction ? WITH_ACTION_MS : VISIBLE_MS;
      const [recommendedMs, screenReaderOn] = await Promise.all([
        AccessibilityInfo.getRecommendedTimeoutMillis(base).catch(() => base),
        AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
      ]);
      const duration = snackDuration({ hasAction, screenReaderOn, recommendedMs });
      if (cancelled || duration === null) return;
      timer = setTimeout(() => {
        if (snackStore.get()?.id === snack.id) snackStore.set(null);
      }, duration);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [snack]);
  if (!snack) return null;
  return (
    <Animated.View
      key={snack.id}
      entering={FadeInDown.springify()}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      // Lifted over the running-timer bar while it shows, so its Stop button stays reachable.
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 92 + lift }}
    >
      <View className="flex-row items-center gap-3 rounded-2xl bg-ink px-4 py-3">
        <Text
          tone="background"
          className="flex-1"
          numberOfLines={2}
          // Kept on screen for screen-reader users until used; this lets them close it.
          accessibilityActions={[{ name: "dismiss", label: "Dismiss" }]}
          onAccessibilityAction={() => snackStore.set(null)}
        >
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
            <Text variant="strong" tone="mangoOnInk">
              {snack.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
