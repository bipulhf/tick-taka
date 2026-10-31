import { useNavigate } from "@tanstack/react-router";
import { addMonths } from "@tick-taka/shared/dates";
import { CalendarPlus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { formatMonth, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useThisMonth } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { useMonthlyReview } from "./queries";

const BACK = { to: "/review", label: "Review" };

/** Budgets vs actual and Someday, then a way into Budgets to plan next month. */
export function MonthlyReview() {
  const navigate = useNavigate();
  const openPanel = useOpenPanel();
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const review = useMonthlyReview(month);
  const next = addMonths(month, 1);
  const header = (
    <PageHeader
      title="Monthly review"
      subtitle={formatMonth(month)}
      back={BACK}
      actions={<MonthStepper month={month} onChange={setMonth} max={thisMonth} />}
    />
  );
  const data = review.data;
  if (!data)
    return (
      <div className="flex flex-col gap-7">
        {header}
        {review.isError ? (
          <ErrorState onRetry={() => void review.refetch()} />
        ) : (
          <div role="status" aria-label="Loading" className="grid grid-cols-1 gap-7 lg:grid-cols-2">
            <SkeletonRows rows={5} />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        )}
      </div>
    );

  const lines = data.budgets.lines.filter((l) => l.hasBudget);
  return (
    <div className="flex flex-col gap-7">
      {header}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-7">
          <Section title="Budgets vs actual">
            {lines.length === 0 ? (
              <EmptyState
                title="No budgets this month"
                message="Set a few limits and this shows how the month went."
                actionLabel="Set budgets"
                onAction={() => openPanel(`budget:${month}`)}
              />
            ) : (
              <Group>
                {lines.map((line) => (
                  <Row
                    key={line.categoryId}
                    leading={<span aria-hidden>{line.emoji}</span>}
                    title={line.name}
                    trailing={
                      <span
                        className={`text-callout tabular ${line.availableMinor < 0 ? "text-coral-text" : "text-muted"}`}
                      >
                        <Amount minor={line.spentMinor} animate={false} /> /{" "}
                        <Amount minor={line.limitMinor} animate={false} />
                      </span>
                    }
                  />
                ))}
              </Group>
            )}
          </Section>
          <Section title="Someday">
            {data.someday.length === 0 ? (
              <EmptyState
                title="Nothing parked"
                message="Ideas you save for later will wait here."
                mood="relaxed"
              />
            ) : (
              <Group>
                {data.someday.map((task) => (
                  <Row
                    key={task.id}
                    title={task.title}
                    trailing={
                      <Button
                        size="sm"
                        aria-label={`Move “${task.title}” to the inbox`}
                        onClick={() =>
                          fire({
                            method: "PATCH",
                            path: `/tasks/${task.id}`,
                            body: { status: "inbox" },
                            label: "Couldn't move the task",
                          })
                        }
                      >
                        Inbox
                      </Button>
                    }
                  />
                ))}
              </Group>
            )}
          </Section>
        </div>
        <div className="flex flex-col gap-7">
          {data.subscriptions.length ? (
            <Button
              icon={RefreshCcw}
              className="self-start"
              onClick={() => void navigate({ to: "/review/subscriptions" })}
            >
              {`${plural(data.subscriptions.length, "repeating charge")} spotted`}
            </Button>
          ) : null}
          <Section
            title={`Budgets for ${formatMonth(next)}`}
            caption="Plan them in Budgets, started from the average of the last three months."
          >
            <Button
              variant="primary"
              icon={CalendarPlus}
              className="self-start"
              onClick={() => void navigate({ to: "/money/budgets", search: { plan: next } })}
            >
              Plan {formatMonth(next)}
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}
