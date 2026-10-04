import { useQuery } from "@tanstack/react-query";
import { SPARKS } from "@tick-taka/shared/gamification";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AppState, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useNow } from "@/features/timer/use-now";
import { api, unwrap } from "@/lib/api";
import { formatTimer } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { cancelFocusEnd, scheduleFocusEnd } from "@/lib/notifications";
import { useOutbox } from "@/lib/outbox";
import { useSettings } from "@/lib/queries";
import { awardSparks } from "@/lib/sparks";
import { useStore } from "@/lib/store";
import { focusStore, REVIVE_WINDOW_MS, setFocusSession } from "./focus-session";
import { Plant } from "./plant";

/** Pomodoro focus timer linked to a task, with Tiki's plant growing while I stay. */
export function FocusScreen({ taskId }: { taskId: string | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const send = useOutbox();
  const { data: settings } = useSettings();
  const session = useStore(focusStore);
  const now = useNow(1000, session !== null);
  const workMs = (settings?.focus.workMinutes ?? 25) * 60_000;
  const breakMs = (settings?.focus.breakMinutes ?? 5) * 60_000;
  const linkedTaskId = session?.taskId ?? taskId;
  const task = useQuery({
    queryKey: ["task", linkedTaskId],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: { id: linkedTaskId! } })),
    enabled: Boolean(linkedTaskId),
  });

  const startWork = () => {
    const startedAt = Date.now();
    const entryId = newId();
    send({
      method: "POST",
      path: "/timer/start",
      body: { id: entryId, taskId: linkedTaskId, source: "focus", startedAt },
      label: "Couldn't start the timer",
    });
    setFocusSession({
      phase: "work",
      startedAt,
      endsAt: startedAt + workMs,
      taskId: linkedTaskId,
      entryId,
      leftAt: null,
      drooping: false,
    });
    void scheduleFocusEnd(startedAt + workMs, "Focus done 🌱", "Time for a short break.");
  };

  const finishWork = (endedAt: number) => {
    send({
      method: "POST",
      path: "/timer/stop",
      body: { endedAt },
      label: "Couldn't stop the timer",
    });
    awardSparks(SPARKS.focusSession);
    haptic.success();
    const current = focusStore.get();
    setFocusSession({
      phase: "break",
      startedAt: endedAt,
      endsAt: endedAt + breakMs,
      taskId: current?.taskId ?? null,
      entryId: null,
      leftAt: null,
      drooping: current?.drooping ?? false,
    });
    void scheduleFocusEnd(endedAt + breakMs, "Break's over", "Ready for another round?");
  };

  const stop = () => {
    if (session?.phase === "work")
      send({
        method: "POST",
        path: "/timer/stop",
        body: { endedAt: Date.now() },
        label: "Couldn't stop the timer",
      });
    void cancelFocusEnd();
    setFocusSession(null);
  };

  // Period ends while the screen is open (or on return after it ended in the background).
  useEffect(() => {
    if (!session || now < session.endsAt) return;
    if (session.phase === "work") finishWork(session.endsAt);
    else {
      haptic.tap();
      setFocusSession(null);
    }
  });

  // Leaving the app makes the plant droop; coming back within a minute revives it.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      const current = focusStore.get();
      if (current?.phase !== "work") return;
      if (status === "background")
        setFocusSession({ ...current, leftAt: Date.now(), drooping: true });
      if (status === "active" && current.leftAt !== null) {
        const revived = Date.now() - current.leftAt <= REVIVE_WINDOW_MS;
        setFocusSession({ ...current, leftAt: null, drooping: !revived });
      }
    });
    return () => subscription.remove();
  }, []);

  const remaining = session ? Math.max(0, session.endsAt - now) : workMs;
  const growth =
    session?.phase === "work"
      ? Math.min(1, (now - session.startedAt) / workMs)
      : session?.phase === "break"
        ? 1
        : 0;
  const drooping = session?.drooping ?? false;

  return (
    <View className="flex-1 bg-background">
      <View
        className={`flex-1 items-center justify-between px-6 ${session?.phase === "break" ? "bg-mint/10" : ""}`}
        style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      >
        <View className="items-center gap-1">
          <Text variant="label" tone="muted">
            {session?.phase === "break" ? "Break" : "Focus"}
          </Text>
          {linkedTaskId && task.data === undefined && !task.isError ? (
            <Skeleton className="my-0.5 h-[22px] w-48" />
          ) : (
            <Text variant="heading" className="text-center" numberOfLines={2}>
              {task.data?.title ?? "Deep work"}
            </Text>
          )}
        </View>
        <View className="items-center">
          <Plant growth={growth} drooping={drooping} />
          <Text variant="display" className="text-6xl" numeric accessibilityLiveRegion="polite">
            {formatTimer(remaining)}
          </Text>
          {drooping ? (
            <Text tone="muted" className="mt-2 text-center">
              The plant missed you. It perks up when you stay.
            </Text>
          ) : null}
        </View>
        <View className="w-full gap-3">
          <View className="flex-row items-center justify-center gap-3">
            <Tiki
              mood={
                session?.phase === "work"
                  ? "focused"
                  : session?.phase === "break"
                    ? "relaxed"
                    : "happy"
              }
              size={56}
            />
            <Text tone="muted" className="flex-1">
              {session?.phase === "work"
                ? "Tiki is watering the plant. Stay with it."
                : session?.phase === "break"
                  ? "Stretch, sip some water."
                  : `${settings?.focus.workMinutes ?? 25} min work, ${settings?.focus.breakMinutes ?? 5} min break.`}
            </Text>
          </View>
          {session ? (
            <Button
              label={session.phase === "work" ? "Stop and log time" : "Skip break"}
              variant="secondary"
              onPress={stop}
            />
          ) : (
            <Button label="Start focus" variant="time" icon="play" onPress={startWork} />
          )}
          <Button label="Close" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}
