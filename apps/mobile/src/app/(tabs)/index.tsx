import { View } from "react-native";
import type { TikiOutfit } from "@/components/tiki/tiki";
import { ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { HabitChips } from "@/features/habits/habit-chips";
import { RUNNING_TIMER_SPACE, RunningTimerBar } from "@/features/timer/running-timer-bar";
import { LaterToday } from "@/features/today/later-today";
import { NextUp } from "@/features/today/next-up";
import { QuickActions } from "@/features/today/quick-actions";
import { SafeToSpendCard } from "@/features/today/safe-to-spend-card";
import { TodayHeader } from "@/features/today/today-header";
import { TodaySkeleton } from "@/features/today/today-skeleton";
import { TopThree } from "@/features/today/top-three";
import { formatLocalDate } from "@/lib/format";
import { useAreas, useLocalToday, useSettings, useToday } from "@/lib/queries";
import { userTime } from "@/lib/user-time";

/** Today answers two questions first: what now, and can I afford it; logging is one tap away. */
export default function TodayScreen() {
  const today = useToday();
  const localToday = useLocalToday();
  const { data: areas } = useAreas();
  const { data: settings } = useSettings();
  const data = today.data;
  const areaEmoji = (areaId: string | null) => areas?.find((a) => a.id === areaId)?.emoji;

  if (!data) {
    return (
      <Screen refreshing={false} onRefresh={() => void today.refetch()}>
        {today.isError ? <ErrorState onRetry={() => void today.refetch()} /> : <TodaySkeleton />}
      </Screen>
    );
  }

  const running = data.runningTimer;
  const timerLabel = running
    ? ((
        data.timeline.find((i) => i.kind === "task" && i.task.id === running.taskId) as
          | { task?: { title: string } }
          | undefined
      )?.task?.title ??
      running.note ??
      (running.source === "focus" ? "Focus" : "Timer"))
    : "";

  return (
    <View className="flex-1">
      <Screen
        refreshing={today.isRefetching}
        onRefresh={() => void today.refetch()}
        // The running-timer bar floats over the end of the list; let it scroll clear.
        extraBottom={running ? RUNNING_TIMER_SPACE : 0}
      >
        <TodayHeader
          data={data}
          outfit={(settings?.tikiOutfit ?? null) as TikiOutfit}
          timeZone={userTime(settings).timeZone}
        />
        {data.date < localToday ? (
          // Past midnight with yesterday's numbers on screen: say so until today's load.
          <Text variant="caption" tone="muted" accessibilityRole="alert">
            {`Showing ${formatLocalDate(data.date, "long")} · today's numbers load once you're back online`}
          </Text>
        ) : null}
        {/* "What now?" and "can I afford it?" first; shortcuts repeat the + button, so they go last. */}
        <SafeToSpendCard data={data} />
        <TopThree data={data} />
        <NextUp data={data} areaEmoji={areaEmoji} />
        <HabitChips data={data} />
        <LaterToday data={data} />
        <QuickActions />
      </Screen>
      {running ? <RunningTimerBar entry={running} label={timerLabel} /> : null}
    </View>
  );
}
