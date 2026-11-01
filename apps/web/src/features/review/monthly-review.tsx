import { useNavigate } from "@tanstack/react-router";
import { addMonths } from "@tick-taka/shared/dates";
import { CalendarPlus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMonth, plural } from "@/lib/format";
import { useThisMonth } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { BudgetsVsActual } from "./monthly-budgets";
import { useMonthlyReview } from "./queries";

/**
 * How the month went (spent, earned, saved, budgets kept), budgets against what was
 * spent, Someday, and "Plan next month" into Budgets.
 */
export function MonthlyReview() {
  const navigate = useNavigate();
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const review = useMonthlyReview(month);
  const next = addMonths(month, 1);
  const data = review.data;
  const current = month === thisMonth;
  const budgeted = data?.budgets.lines.filter((l) => l.hasBudget) ?? [];
  const kept = budgeted.filter((l) => l.availableMinor >= 0).length;
  const loading = !data;

  const header = (
    <PageHeader
      title="Monthly review"
      subtitle={formatMonth(month)}
      actions={<MonthStepper month={month} onChange={setMonth} max={thisMonth} />}
      primary={{
        label: `Plan ${formatMonth(next)}`,
        icon: CalendarPlus,
        onClick: () => void navigate({ to: "/money/budgets", search: { plan: next } }),
      }}
      summary={
        review.isError && !data ? undefined : (
          <SummaryStrip label={`${formatMonth(month)} in numbers`}>
            <StatTile
              label={current ? "Spent so far" : "Spent"}
              tone="out"
              minor={data?.totals.spentMinor}
              caption={formatMonth(month)}
              loading={loading}
            />
            <StatTile
              label="Earned"
              tone="in"
              minor={data?.totals.incomeMinor}
              caption={formatMonth(month)}
              loading={loading}
            />
            <StatTile
              label={(data?.totals.netMinor ?? 0) < 0 ? "Drawn from savings" : "Saved"}
              tone="flow"
              minor={data?.totals.netMinor}
              caption="Earned minus spent"
              loading={loading}
            />
            <StatTile
              label="Budgets kept"
              value={budgeted.length ? `${kept} of ${budgeted.length}` : "None set"}
              caption={
                budgeted.length
                  ? current
                    ? "Within the limit so far"
                    : "Within the limit"
                  : "Set limits in Budgets"
              }
              loading={loading}
            />
          </SummaryStrip>
        )
      }
    />
  );

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

  return (
    <div className="flex flex-col gap-7">
      {header}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <BudgetsVsActual lines={data.budgets.lines} month={month} />
        <div className="flex flex-col gap-7">
          <Section
            title="Next month"
            caption={`Plan ${formatMonth(next)} in Budgets, started from the average of the last three months.`}
          >
            {data.subscriptions.length ? (
              <Button
                icon={RefreshCcw}
                className="self-start"
                onClick={() => void navigate({ to: "/money/bills" })}
              >
                {`${plural(data.subscriptions.length, "repeating charge")} spotted`}
              </Button>
            ) : null}
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
      </div>
    </div>
  );
}
