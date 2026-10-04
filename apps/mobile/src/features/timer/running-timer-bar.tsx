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
        className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 ${focus ? "bg-sky" : "bg-ink"}`}
      >
        <Icon name={focus ? "sprout" : "timer-outline"} color="white" />
        <Text variant="strong" tone="inverse" className="flex-1" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="heading" tone="inverse" numeric>
          {formatTimer(now - entry.startedAt)}
        </Text>
        <Pressable
          hitSlop={10}
          accessibilityLabel="Stop timer"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/25"
          onPress={() => {
            updateToday(client, (d) => ({ ...d, runningTimer: null }));
            send({
              method: "POST",
              path: "/timer/stop",
              body: { endedAt: Date.now() },
              label: "Couldn't stop the timer",
            });
          }}
        >
          <Icon name="stop" color="white" />
        </Pressable>
      </Pressable>
    </View>
  );
}
