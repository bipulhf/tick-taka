import { onlineManager } from "@tanstack/react-query";
import { weekdayOf } from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { Icon } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import type { OutboxRequest } from "@/lib/outbox-policy";
import { usePrivacy } from "@/lib/privacy";
import type { TodayData } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { movedBefore, movedMessage, undoMoves } from "./bulk-move";

/**
 * Everything that isn't "now": one quiet line each, opening into detail. Keeps the
 * top of Today down to the essentials.
 */
export function LaterToday({ data }: { data: TodayData }) {
  const router = useRouter();
  const send = useOutbox();
  const hidden = usePrivacy();
  const [eveningOpen, setEveningOpen] = useState(false);
  const overdue = data.counts.overdue;
  const nextBill = data.upcoming[0];
  const overflow = data.dayFit.overflowMinutes;
  const friday = weekdayOf(data.date) === 5;

  // The server picks the tasks; once it answers, name them and offer Undo.
  const bulkMove = (request: OutboxRequest, where: string) => {
    if (!onlineManager.isOnline()) notify(`They'll move to ${where} once you're back online`);
    send
      .async(request)
      .then((reply) => {
        const before = movedBefore(reply);
        notify(
          movedMessage(before, where),
          before.length
            ? {
                label: "Undo",
                onPress: () => {
                  for (const undo of undoMoves(before, editTime())) send(undo);
                },
              }
            : undefined,
        );
      })
      // A refusal is reported by the outbox.
      .catch(() => {});
  };

  const rows = [
    overflow > 0 ? (
      <ListRow
        key="fit"
        icon="scale-unbalanced"
        iconColor="coral"
        title="The day doesn't quite fit"
        subtitle={`${formatMinutes(overflow)} over your free time`}
        right={
          <Button
            label="Move"
            size="sm"
            variant="secondary"
            onPress={() =>
              bulkMove(
                {
                  method: "POST",
                  path: "/tasks/move-low-priority",
                  body: { date: data.date, minutesToFree: overflow },
                  label: "Couldn't move tasks",
                },
                "tomorrow",
              )
            }
          />
        }
      />
    ) : null,
    overdue > 0 ? (
      <ListRow
        key="overdue"
        icon="history"
        iconColor="sky"
        title={
          overdue === 1 && data.counts.latestOverdue
            ? data.counts.latestOverdue
            : `${overdue} tasks from earlier`
        }
        subtitle={
          overdue === 1
            ? "From earlier. Bring it into today?"
            : data.counts.latestOverdue
              ? `Like “${data.counts.latestOverdue}”. Bring them into today?`
              : "No rush. Bring them into today?"
        }
        right={
          <Button
            label="Today"
            size="sm"
            variant="secondary"
            onPress={() =>
              bulkMove(
                {
                  method: "POST",
                  path: "/tasks/rescue-overdue",
                  body: { target: "today", date: data.date },
                  label: "Couldn't move tasks",
                },
                "today",
              )
            }
          />
        }
      />
    ) : null,
    data.evening.length > 0 ? (
      <ListRow
        key="evening"
        icon="weather-night"
        iconColor="grape"
        title="This evening"
        subtitle={plural(data.evening.length, "task")}
        onPress={() => setEveningOpen(!eveningOpen)}
        right={<Icon name={eveningOpen ? "chevron-up" : "chevron-down"} color="muted" />}
      />
    ) : null,
    ...(eveningOpen
      ? data.evening.map((task) => <TaskRow key={`evening-${task.id}`} task={task} />)
      : []),
    nextBill ? (
      <ListRow
        key="bill"
        icon={nextBill.kind === "bill" ? "receipt" : "cash-plus"}
        iconColor={nextBill.kind === "bill" ? "coral" : "mint"}
        title={nextBill.name}
        subtitle={`${formatLocalDate(nextBill.dueDate)} · ${hidden ? "•••" : formatAmount(nextBill.amountMinor, { currency: nextBill.currency })}`}
        chevron
        onPress={() => router.push("/money/bills")}
      />
    ) : null,
    data.counts.inbox > 0 ? (
      <ListRow
        key="inbox"
        icon="inbox-outline"
        iconColor="sky"
        title={`${plural(data.counts.inbox, "idea")} in the inbox`}
        subtitle="Sort them this evening"
        chevron
        onPress={() => router.push("/plan")}
      />
    ) : null,
    friday ? (
      <ListRow
        key="recap"
        icon="chart-line"
        iconColor="grape"
        title="Your weekly recap is ready"
        chevron
        onPress={() => router.push("/review/weekly")}
      />
    ) : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) return null;
  return (
    <Section title="Later">
      <Group inset={60}>{rows}</Group>
    </Section>
  );
}
