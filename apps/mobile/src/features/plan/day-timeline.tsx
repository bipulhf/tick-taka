import { useMutation } from "@tanstack/react-query";
import { endOfLocalDay, localMinuteOfDay, startOfLocalDay } from "@tick-taka/shared/dates";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Draggable, DragProvider, DropZone } from "@/components/ui/drag";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { api, unwrap } from "@/lib/api";
import { formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAiStatus, useSettings } from "@/lib/queries";
import { CompactTask } from "./compact-task";
import { type PlanTask, useTasks } from "./queries";
import { useMoveTask } from "./use-move-task";

const START_HOUR = 6;
const END_HOUR = 23;
const PX_PER_MIN = 1.6;
const SNAP_MIN = 15;

type Plan = Awaited<ReturnType<typeof requestPlan>>;
const requestPlan = (date: string) => unwrap(api.ai["plan-day"].$post({ json: { date } }));

/** One day as time blocks: drag a task to a time; or let AI propose the whole day. */
export function DayTimeline({ date }: { date: string }) {
  const { data: settings } = useSettings();
  const ai = useAiStatus();
  const send = useOutbox();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const tasks = useTasks({
    status: "inbox,open,done",
    from: String(startOfLocalDay(date, timeZone)),
    to: String(endOfLocalDay(date, timeZone)),
  });
  const top = useTasks({ top3Date: date });
  const move = useMoveTask(timeZone);
  const [proposal, setProposal] = useState<Plan | null>(null);
  const plan = useMutation({
    mutationFn: () => requestPlan(date),
    onSuccess: setProposal,
    onError: (e) => notify(e.message),
  });

  const all = new Map<string, PlanTask>(
    [...(tasks.data ?? []), ...(top.data ?? [])].map((t) => [t.id, t]),
  );
  const timed = [...all.values()].filter((t) => t.hasTime && t.doAt !== null);
  const untimed = [...all.values()].filter(
    (t) => !(t.hasTime && t.doAt !== null) && t.status !== "done",
  );
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const onDrop = (taskId: string, zoneId: string, point: { y: number }) => {
    const task = all.get(taskId);
    if (!task || zoneId !== "grid") return;
    const minute = START_HOUR * 60 + Math.round(point.y / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    move.toTime(task, date, Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - SNAP_MIN, minute)));
  };

  const applyProposal = () => {
    if (!proposal) return;
    for (const block of proposal.blocks) {
      if (!block.taskId) continue;
      send({
        method: "PATCH",
        path: `/tasks/${block.taskId}`,
        body: {
          doAt: block.startAt,
          hasTime: true,
          reminderAt: block.startAt,
          estimateMin: Math.round((block.endAt - block.startAt) / 60_000),
          status: "open",
          updatedAt: Date.now(),
        },
        label: "Couldn't apply the plan",
      });
    }
    setProposal(null);
    notify("Plan applied. Drag anything around.");
  };

  return (
    <DragProvider onDrop={onDrop}>
      <Screen
        title={formatLocalDate(date, "long")}
        subtitle="Long-press a task and drop it on a time"
        tabBarPadding={false}
      >
        {ai.data?.configured && ai.data.features.planDay ? (
          <Button
            label="Plan my day"
            icon="auto-fix"
            variant="secondary"
            loading={plan.isPending}
            onPress={() => plan.mutate()}
          />
        ) : null}
        {proposal ? (
          <Card className="gap-2">
            <Text variant="strong">✨ {proposal.note}</Text>
            {proposal.blocks.map((block) => (
              <Text key={`${block.start}-${block.title}`} variant="caption">
                {block.start}–{block.end} · {block.title}
              </Text>
            ))}
            <View className="flex-row gap-2">
              <Button
                label="Not now"
                variant="secondary"
                size="sm"
                onPress={() => setProposal(null)}
                className="flex-1"
              />
              <Button label="Apply" size="sm" onPress={applyProposal} className="flex-1" />
            </View>
          </Card>
        ) : null}
        {untimed.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" tone="muted">
              No time yet
            </Text>
            {untimed.map((task) => (
              <Draggable key={task.id} id={task.id}>
                <CompactTask task={task} tone="grape" />
              </Draggable>
            ))}
          </View>
        ) : null}
        <DropZone
          id="grid"
          style={{ height: hours.length * 60 * PX_PER_MIN }}
          className="rounded-2xl bg-card/60"
        >
          {hours.map((hour) => (
            <View
              key={hour}
              style={{
                position: "absolute",
                top: (hour - START_HOUR) * 60 * PX_PER_MIN,
                left: 0,
                right: 0,
              }}
              className="flex-row border-t border-line"
            >
              <Text variant="caption" tone="muted" className="w-14 pl-2 pt-0.5" numeric>
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </Text>
            </View>
          ))}
          {timed.map((task) => {
            const minute = localMinuteOfDay(task.doAt!, timeZone);
            const top = Math.max(0, (minute - START_HOUR * 60) * PX_PER_MIN);
            const height = Math.max(44, (task.estimateMin ?? 30) * PX_PER_MIN);
            return (
              <View key={task.id} style={{ position: "absolute", top, left: 58, right: 8, height }}>
                <Draggable id={task.id}>
                  <View style={{ height }} className="justify-center rounded-xl bg-sky/20 px-1">
                    <CompactTask task={task} />
                  </View>
                </Draggable>
              </View>
            );
          })}
        </DropZone>
      </Screen>
    </DragProvider>
  );
}
