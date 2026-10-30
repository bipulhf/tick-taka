import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addMonths } from "@tick-taka/shared/dates";
import { RefreshCcw, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatMinutes, formatMonth, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAiStatus, useAreas, useCategories } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { useThisMonth } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { useMonthlyReview } from "./queries";

const BACK = { to: "/review", label: "Review" };

/** Budgets vs actual, net worth change, hourly rates, Someday, then next month's budgets. */
export function MonthlyReview() {
  const navigate = useNavigate();
  const openPanel = useOpenPanel();
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const review = useMonthlyReview(month);
  const ai = useAiStatus();
  const { data: areas = [] } = useAreas();
  const { data: categories = [] } = useCategories();
  const next = addMonths(month, 1);
  const openBudgets = (limits: { categoryId: string; limitMinor: number }[]) =>
    openPanel(`budget:${next}`, {
      suggested: JSON.stringify(
        Object.fromEntries(limits.map((b) => [b.categoryId, b.limitMinor])),
      ),
    });
  const aiBudgets = useMutation({
    mutationFn: () => unwrap(api.ai["budget-suggestions"].$post({ json: { month: next } })),
    onSuccess: (result) => openBudgets(result.budgets),
    onError: (e) => notify(friendlyError(e)),
  });
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
  const change = data.netWorth.changeMinor;
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
          <Section title="Net worth">
            <div className="rounded-2xl bg-card p-5">
              {change === null ? (
                <p className="text-heading text-muted">Not enough history yet</p>
              ) : (
                <Amount
                  minor={change}
                  signed
                  tone="flow"
                  animate={false}
                  className="block text-title"
                />
              )}
              {data.netWorth.endMinor !== null ? (
                <p className="text-callout text-muted">
                  Now <Amount minor={data.netWorth.endMinor} animate={false} />
                </p>
              ) : null}
            </div>
          </Section>
          <Section title="Hourly rate by area">
            {data.hourlyRates.length === 0 ? (
              <EmptyState
                title="No hourly rates yet"
                message="Tag income and time with areas to see which work pays best."
              />
            ) : (
              <Group>
                {data.hourlyRates.map((rate) => {
                  const area = areas.find((a) => a.id === rate.areaId);
                  return (
                    <Row
                      key={rate.areaId}
                      leading={area ? <span aria-hidden>{area.emoji}</span> : undefined}
                      title={area?.name ?? "Area"}
                      trailing={
                        <span className="text-callout tabular">
                          {rate.rateMinor === null || rate.incomeMinor === 0 ? (
                            <span className="text-muted">
                              {formatMinutes(rate.minutes)}, no income
                            </span>
                          ) : (
                            <>
                              <Amount
                                minor={Math.round(rate.rateMinor / 100) * 100}
                                animate={false}
                              />
                              /h
                            </>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </Group>
            )}
          </Section>
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
            caption="From the average of the last three months."
          >
            {data.suggestedBudgets.length === 0 ? (
              <EmptyState
                title="Nothing to suggest yet"
                message="A few months of spending gives next month's budgets a starting point."
                mood="relaxed"
              />
            ) : (
              <div className="flex flex-col gap-3">
                <Group>
                  {data.suggestedBudgets.slice(0, 6).map((line) => {
                    const category = categories.find((c) => c.id === line.categoryId);
                    return (
                      <Row
                        key={line.categoryId}
                        leading={category ? <span aria-hidden>{category.emoji}</span> : undefined}
                        title={category?.name ?? "Category"}
                        trailing={
                          <Amount
                            minor={line.limitMinor}
                            animate={false}
                            className="text-callout"
                          />
                        }
                      />
                    );
                  })}
                </Group>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => openBudgets(data.suggestedBudgets)}>
                    Use these
                  </Button>
                  {ai.data?.configured && ai.data.features.budgetSuggestions ? (
                    <Button
                      icon={WandSparkles}
                      loading={aiBudgets.isPending}
                      onClick={() => aiBudgets.mutate()}
                    >
                      Ask AI for suggestions
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
