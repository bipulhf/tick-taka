import { useNavigate } from "@tanstack/react-router";
import { weekdayOf } from "@tick-taka/shared/dates";
import { ChartLine, ChevronDown, ChevronUp, History, Inbox, Moon, Scale } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { TaskRow } from "@/features/tasks/task-row";
import { formatMinutes, plural } from "@/lib/format";
import type { TodayData } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { fire, type WriteRequest, write } from "@/lib/write";
import { movedBefore, movedMessage, undoMoves } from "./bulk-move";

/**
 * Everything that isn't "now": one quiet line each, opening into detail. Keeps the
 * top of Today down to the essentials. Old tasks are a gentle offer, never an alarm.
 */
export function LaterToday({ data }: { data: TodayData }) {
  const navigate = useNavigate();
  const [eveningOpen, setEveningOpen] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const overdue = data.counts.overdue;
  const overflow = data.dayFit.overflowMinutes;
  const friday = weekdayOf(data.date) === 5;

  // The server picks the tasks; once it answers, name them and offer Undo.
  const bulkMove = async (key: string, request: WriteRequest, where: string) => {
    setMoving(key);
    try {
      const before = movedBefore(await write(request));
      notify(
        movedMessage(before, where),
        before.length
          ? {
              label: "Undo",
              onPress: () => {
                for (const undo of undoMoves(before)) fire(undo);
              },
            }
          : undefined,
      );
    } catch {
      // The toast already says why.
    } finally {
      setMoving(null);
    }
  };

  const rows = [
    overflow > 0 ? (
      <Row
        as="li"
        key="fit"
        leading={<RowMark icon={Scale} />}
        title="The day doesn't quite fit"
        subtitle={`${formatMinutes(overflow)} over your free time`}
        trailing={
          <Button
            size="sm"
            loading={moving === "fit"}
            onClick={() =>
              void bulkMove(
                "fit",
                {
                  method: "POST",
                  path: "/tasks/move-low-priority",
                  body: { date: data.date, minutesToFree: overflow },
                  label: "Couldn't move tasks",
                },
                "tomorrow",
              )
            }
          >
            Move
          </Button>
        }
      />
    ) : null,
    overdue > 0 ? (
      <Row
        as="li"
        key="overdue"
        leading={<RowMark icon={History} tone="sky" />}
        title={
          overdue === 1 && data.counts.latestOverdue
            ? data.counts.latestOverdue
            : `${plural(overdue, "task")} from earlier`
        }
        subtitle={
          overdue === 1
            ? "From earlier. Bring it into today?"
            : data.counts.latestOverdue
              ? `Like “${data.counts.latestOverdue}”. Bring them into today?`
              : "No rush. Bring them into today?"
        }
        trailing={
          <Button
            size="sm"
            loading={moving === "overdue"}
            onClick={() =>
              void bulkMove(
                "overdue",
                {
                  method: "POST",
                  path: "/tasks/rescue-overdue",
                  body: { target: "today", date: data.date },
                  label: "Couldn't move tasks",
                },
                "today",
              )
            }
          >
            Today
          </Button>
        }
      />
    ) : null,
    data.evening.length > 0 ? (
      <li key="evening" className="relative">
        <button
          type="button"
          aria-expanded={eveningOpen}
          onClick={() => setEveningOpen(!eveningOpen)}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-line/30"
        >
          <RowMark icon={Moon} tone="sky" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">This evening</span>
            <span className="block text-callout text-muted">
              {plural(data.evening.length, "task")}
            </span>
          </span>
          {eveningOpen ? (
            <ChevronUp aria-hidden className="size-4 text-muted" />
          ) : (
            <ChevronDown aria-hidden className="size-4 text-muted" />
          )}
        </button>
      </li>
    ) : null,
    ...(eveningOpen
      ? data.evening.map((task) => <TaskRow key={`evening-${task.id}`} as="li" task={task} />)
      : []),
    data.counts.inbox > 0 ? (
      <Row
        as="li"
        key="inbox"
        leading={<RowMark icon={Inbox} tone="sky" />}
        title={`${plural(data.counts.inbox, "idea")} in the inbox`}
        subtitle="Sort them this evening"
        chevron
        onClick={() => void navigate({ to: "/plan" })}
      />
    ) : null,
    friday ? (
      <Row
        as="li"
        key="recap"
        leading={<RowMark icon={ChartLine} />}
        title="Your weekly recap is ready"
        chevron
        onClick={() => void navigate({ to: "/review/weekly" })}
      />
    ) : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) return null;
  return (
    <Section title="Later" id="today-later">
      <Group as="ul" label="Later">
        {rows}
      </Group>
    </Section>
  );
}
