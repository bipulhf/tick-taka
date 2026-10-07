import {
  addDays,
  endOfLocalDay,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
} from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Draggable, DragProvider, DropZone } from "@/components/ui/drag";
import { IconButton } from "@/components/ui/icon-button";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatMinutes } from "@/lib/format";
import { pickDate } from "@/lib/pick-date";
import { useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { CompactTask, type PlanAction } from "./compact-task";
import { type PlanTask, useTasks } from "./queries";
import { useMoveTask } from "./use-move-task";

/** Drag tasks onto days; tap a day to place them into time blocks. */
export function WeekPlanner() {
  const router = useRouter();
  const { data: settings } = useSettings();
  const timeZone = userTime(settings).timeZone;
  const today = useTodayDate();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(today, userTime(settings).weekStartsOn),
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week = useTasks({
    status: "inbox,open,done",
    from: String(startOfLocalDay(weekStart, timeZone)),
    to: String(endOfLocalDay(addDays(weekStart, 6), timeZone)),
  });
  const unscheduled = useTasks({ status: "inbox,open" });
  const tray = (unscheduled.data ?? []).filter((t) => t.doAt === null);
  const move = useMoveTask(timeZone);
  const all = new Map<string, PlanTask>([...(week.data ?? []), ...tray].map((t) => [t.id, t]));
  const capacity = settings?.dayCapacityMinutes ?? 360;

  // Screen readers can't drag, so the same moves are in each card's actions menu.
  const pickDay = async (task: PlanTask) => {
    const date = await pickDate(task.doAt ?? Date.now(), timeZone);
    if (date) move.toDay(task, date);
  };
  const scheduleActions = (task: PlanTask): PlanAction[] => [
    { label: "Schedule for today", run: () => move.toDay(task, today) },
    { label: "Schedule for tomorrow", run: () => move.toDay(task, addDays(today, 1)) },
    { label: "Schedule for a date", run: () => void pickDay(task) },
    ...(task.doAt !== null ? [{ label: "Unschedule", run: () => move.unschedule(task) }] : []),
  ];

  const onDrop = (taskId: string, zoneId: string) => {
    const task = all.get(taskId);
    if (!task) return;
    if (zoneId === "tray") move.unschedule(task);
    else move.toDay(task, zoneId);
  };

  return (
    <DragProvider onDrop={onDrop}>
      <Screen
        title="Week"
        subtitle={`${formatLocalDate(weekStart)} – ${formatLocalDate(addDays(weekStart, 6))}`}
        tabBarPadding={false}
        right={
          <View className="flex-row">
            <IconButton
              icon="chevron-left"
              label="Previous week"
              onPress={() => setWeekStart(addDays(weekStart, -7))}
            />
            <IconButton
              icon="chevron-right"
              label="Next week"
              onPress={() => setWeekStart(addDays(weekStart, 7))}
            />
          </View>
        }
      >
        <DropZone id="tray" className="gap-2 rounded-2xl border border-dashed border-line p-3">
          <Text variant="label" tone="muted">
            Unscheduled · long-press to drag
          </Text>
          {unscheduled.data === undefined ? (
            <Skeleton className="h-11 w-full rounded-xl" />
          ) : tray.length === 0 ? (
            <Text variant="caption" tone="muted">
              Nothing waiting.
            </Text>
          ) : null}
          {tray.map((task) => (
            <Draggable key={task.id} id={task.id}>
              <CompactTask task={task} tone="neutral" actions={scheduleActions(task)} />
            </Draggable>
          ))}
        </DropZone>
        <AsyncContent
          query={week}
          skeleton={days.map((day) => <Skeleton key={day} className="h-16 w-full rounded-2xl" />)}
        >
          {() =>
            days.map((day) => {
              const tasks = (week.data ?? []).filter(
                (t) => t.doAt !== null && toLocalDate(t.doAt, timeZone) === day,
              );
              const planned = tasks
                .filter((t) => t.status !== "done")
                .reduce((sum, t) => sum + (t.estimateMin ?? 30), 0);
              return (
                <DropZone
                  key={day}
                  id={day}
                  className={`gap-2 rounded-2xl p-3 ${day === today ? "bg-sky/10" : "bg-card/60"}`}
                >
                  <Pressable
                    onPress={() => router.push(`/plan/day?date=${day}`)}
                    className="min-h-12 flex-row items-center justify-between"
                    accessibilityRole="button"
                  >
                    <Text variant="strong" className="flex-1" numberOfLines={1}>
                      {formatLocalDate(day, "long")}
                    </Text>
                    <Text variant="caption" tone="muted" numeric>
                      {formatMinutes(planned)} planned{planned > capacity ? " · a full day" : ""} ›
                    </Text>
                  </Pressable>
                  {tasks.map((task) => (
                    <Draggable key={task.id} id={task.id}>
                      <CompactTask task={task} actions={scheduleActions(task)} />
                    </Draggable>
                  ))}
                </DropZone>
              );
            })
          }
        </AsyncContent>
      </Screen>
    </DragProvider>
  );
}
