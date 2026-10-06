import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from "@/components/navigation/tab-bar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatTimer } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import type { TodayData } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { updateToday } from "@/lib/today-cache";
import { useNow } from "./use-now";

/** Sticky bar while a focus session or time entry is running. */
export function RunningTimerBar({
  entry,
  label,
}: {
  entry: NonNullable<TodayData["runningTimer"]>;
  label: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const send = useOutbox();
  const now = useNow();
  const focus = entry.source === "focus";
  return (
    // Sits just above the floating tab bar.
    <View
      className="absolute left-4 right-4"
      style={{ bottom: insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + 8 }}
    >
      <Pressable
        onPress={() => router.push(focus ? "/focus" : "/plan/time")}
        accessibilityRole="button"
        accessibilityLabel={`${label} running, ${formatTimer(now - entry.startedAt)}`}
        accessibilityHint="Opens the timer"
        // A raised card with a sky mark, not a large sky fill: colour stays a small mark.
        className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-card px-4 py-2"
        style={{ elevation: 8 }}
      >
        <Icon name={focus ? "sprout" : "timer-outline"} color="sky" />
        <Text variant="strong" className="flex-1" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="heading" numeric maxFontSizeMultiplier={1.3}>
          {formatTimer(now - entry.startedAt)}
        </Text>
        <Pressable
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Stop timer"
          className="h-12 w-12 items-center justify-center rounded-full bg-background"
          onPress={() => {
            updateToday(client, (d) => ({ ...d, runningTimer: null }));
            send({
              method: "POST",
              path: "/timer/stop",
              body: { endedAt: editTime() },
              label: "Couldn't stop the timer",
            });
          }}
        >
          <Icon name="stop" color="ink" />
        </Pressable>
      </Pressable>
    </View>
  );
}
