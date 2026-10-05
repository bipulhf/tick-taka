import { View } from "react-native";
import type { TikiOutfit } from "@/components/tiki/tiki";
import { ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { HabitChips } from "@/features/habits/habit-chips";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { RunningTimerBar } from "@/features/timer/running-timer-bar";
import { LaterToday } from "@/features/today/later-today";
import { NextUp } from "@/features/today/next-up";
import { QuickActions } from "@/features/today/quick-actions";
import { SafeToSpendCard } from "@/features/today/safe-to-spend-card";
import { TodayHeader } from "@/features/today/today-header";
import { TodaySkeleton } from "@/features/today/today-skeleton";
import { TopThree } from "@/features/today/top-three";
import { useAreas, useSettings, useToday } from "@/lib/queries";

/** Today answers two questions first: what now, and can I afford it; logging is one tap away. */
export default function TodayScreen() {
  const today = useToday();
  const { data: areas } = useAreas();
  const { data: settings } = useSettings();
  const smsPending = useSmsPendingCount();
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
      <Screen refreshing={today.isRefetching} onRefresh={() => void today.refetch()}>
        <TodayHeader data={data} outfit={(settings?.tikiOutfit ?? null) as TikiOutfit} />
        <QuickActions />
        <SafeToSpendCard data={data} />
        <TopThree data={data} />
        <NextUp data={data} areaEmoji={areaEmoji} />
        <HabitChips data={data} />
        <LaterToday data={data} smsPending={smsPending} />
      </Screen>
      {running ? <RunningTimerBar entry={running} label={timerLabel} /> : null}
    </View>
  );
}
