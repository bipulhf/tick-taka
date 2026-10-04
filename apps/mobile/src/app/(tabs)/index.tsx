import { useRouter } from "expo-router";
import { View } from "react-native";
import type { TikiOutfit } from "@/components/tiki/tiki";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { HabitChips } from "@/features/habits/habit-chips";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { RunningTimerBar } from "@/features/timer/running-timer-bar";
import { EveningSection } from "@/features/today/evening-section";
import { SafeToSpendCard } from "@/features/today/safe-to-spend-card";
import { Timeline } from "@/features/today/timeline";
import { OverdueBanner, SmsBanner, WeeklyRecapCard } from "@/features/today/today-banners";
import { TodayHeader } from "@/features/today/today-header";
import { TopThree } from "@/features/today/top-three";
import { useAreas, useSettings, useToday } from "@/lib/queries";

export default function TodayScreen() {
  const router = useRouter();
  const today = useToday();
  const { data: areas } = useAreas();
  const { data: settings } = useSettings();
  const smsPending = useSmsPendingCount();
  const data = today.data;
  const areaEmoji = (areaId: string | null) => areas?.find((a) => a.id === areaId)?.emoji;

  if (!data) {
    return (
      <Screen>
        <EmptyState
          message={
            today.isError ? "Can't reach the server yet. Pull to retry." : "Getting today ready…"
          }
          actionLabel="Try again"
          onAction={() => void today.refetch()}
          mood={today.isError ? "calm" : "curious"}
        />
      </Screen>
    );
  }

  const timerLabel = data.runningTimer
    ? ((
        data.timeline.find((i) => i.kind === "task" && i.task.id === data.runningTimer?.taskId) as
          | { task?: { title: string } }
          | undefined
      )?.task?.title ??
      data.runningTimer.note ??
      (data.runningTimer.source === "focus" ? "Focus" : "Timer"))
    : "";

  return (
    <View className="flex-1">
      <Screen refreshing={today.isRefetching} onRefresh={() => void today.refetch()}>
        <TodayHeader data={data} outfit={(settings?.tikiOutfit ?? null) as TikiOutfit} />
        <SmsBanner count={smsPending} />
        <SafeToSpendCard data={data} />
        <WeeklyRecapCard date={data.date} />
        <OverdueBanner data={data} />
        <TopThree data={data} />
        <Timeline data={data} areaEmoji={areaEmoji} />
        <HabitChips data={data} />
        <EveningSection data={data} />
        {data.counts.inbox > 0 ? (
          <EmptyState
            message={`${data.counts.inbox} in the inbox, waiting for the evening sort.`}
            actionLabel="Open inbox"
            onAction={() => router.push("/plan")}
            mood="happy"
          />
        ) : null}
      </Screen>
      {data.runningTimer ? <RunningTimerBar entry={data.runningTimer} label={timerLabel} /> : null}
    </View>
  );
}
