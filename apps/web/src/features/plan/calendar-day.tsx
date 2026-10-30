import { Banknote, Plus, Receipt } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import type { PlanTask, RecurringItem } from "./queries";

/** The picked day under (or beside) the calendar: its bills and paydays, then its tasks. */
export function CalendarDay({
  date,
  tasks,
  bills,
  loading,
}: {
  date: string;
  tasks: PlanTask[];
  bills: RecurringItem[];
  loading: boolean;
}) {
  const open = useOpenPanel();
  return (
    <Section
      id="calendar-day"
      title={formatLocalDate(date, "long")}
      action={
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onClick={() => open("task:new", { doDate: date })}
        >
          Add
        </Button>
      }
    >
      <div aria-live="polite" className="flex flex-col gap-3">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : tasks.length === 0 && bills.length === 0 ? (
          <EmptyState
            title="A free day"
            message="Nothing planned or due. Enjoy the room to breathe."
            mood="relaxed"
          />
        ) : (
          <>
            {bills.length ? (
              <Group as="ul" label="Bills and paydays">
                {bills.map((bill) => (
                  <Row
                    key={bill.id}
                    as="li"
                    leading={
                      <RowMark
                        icon={bill.kind === "bill" ? Receipt : Banknote}
                        tone={bill.kind === "bill" ? "coral" : "mint"}
                      />
                    }
                    title={bill.name}
                    subtitle={bill.kind === "bill" ? "Bill" : "Payday"}
                    trailing={
                      <Amount
                        minor={bill.kind === "bill" ? -bill.amountMinor : bill.amountMinor}
                        currency={bill.currency}
                        signed
                        tone="flow"
                        animate={false}
                        className="font-bold"
                      />
                    }
                  />
                ))}
              </Group>
            ) : null}
            {tasks.length ? (
              <Group as="ul" label="Tasks">
                {tasks.map((task) => (
                  <TaskRow key={task.id} as="li" task={task} />
                ))}
              </Group>
            ) : null}
          </>
        )}
      </div>
    </Section>
  );
}
