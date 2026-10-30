import { endOfLocalDay, localMonthRange, startOfLocalDay } from "@tick-taka/shared/dates";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Amount } from "@/components/ui/amount";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { formatAmount, formatLocalDate } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { monthCells, spendBarPercent, stepDay, weekdayHeadings } from "./calendar-cells";
import { useInsights, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

/** The selected day's transactions, beside the grid on a wide screen. */
function DayList({ date, spent }: { date: string; spent: number | null }) {
  const { timeZone } = useUserTime();
  const lookup = useLookup();
  const day = useTransactions({
    from: String(startOfLocalDay(date, timeZone)),
    to: String(endOfLocalDay(date, timeZone)),
    limit: "100",
  });
  const items = day.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section aria-labelledby="money-day-title" className="flex flex-col gap-3">
      {/* The day's spend at a readable size, instead of a figure in every cell. */}
      <div className="flex min-h-8 items-baseline justify-between gap-3 px-1">
        <h2 id="money-day-title" className="text-heading">
          {formatLocalDate(date, "long")}
        </h2>
        {spent !== null ? (
          <span className="text-callout text-muted">
            Spent <Amount minor={spent} animate={false} className="font-bold text-ink" />
          </span>
        ) : null}
      </div>
      {!day.data ? (
        day.isError ? (
          <ErrorState onRetry={() => void day.refetch()} />
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing logged this day"
          message="A quiet day for your wallet. Pick another day to see where money moved."
          mood="relaxed"
        />
      ) : (
        <Group>
          {items.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} lookup={lookup} timeOnly />
          ))}
        </Group>
      )}
    </section>
  );
}

/** A month grid of daily spending; pick a spike to see what it was. */
export function MoneyCalendar() {
  const { timeZone, weekStartsOn } = useUserTime();
  const hidden = usePrivacy();
  const today = useTodayDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const range = localMonthRange(month, timeZone);
  const insights = useInsights(range.from, range.to);
  const byDay = new Map((insights.data?.byDay ?? []).map((d) => [d.date, d.spentMinor]));
  const max = Math.max(1, ...byDay.values());
  const cells = monthCells(month, weekStartsOn);

  // Arrow keys move the selection; the focus follows it once the grid has redrawn.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent) => {
    const next = stepDay(selected, event.key);
    if (!next) return;
    event.preventDefault();
    moved.current = true;
    if (next.slice(0, 7) !== month && !cells.includes(next)) setMonth(next.slice(0, 7));
    setSelected(next);
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Spending calendar"
        subtitle={
          insights.data
            ? `Spent ${hidden ? "•••" : formatAmount(insights.data.totals.spentMinor)}`
            : undefined
        }
        back={{ to: "/money", label: "Money" }}
        actions={<MonthStepper month={month} onChange={setMonth} />}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {insights.isError ? (
          <ErrorState onRetry={() => void insights.refetch()} />
        ) : !insights.data ? (
          <Skeleton className="h-[26rem] w-full rounded-2xl" />
        ) : (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a form's frame and legend
          <div
            ref={grid}
            role="group"
            aria-label="Spending by day. Arrow keys move between days."
            onKeyDown={onKeyDown}
            className="-mx-3 rounded-2xl bg-card px-1.5 py-3 sm:mx-0 sm:px-3"
          >
            <div aria-hidden className="grid grid-cols-7">
              {weekdayHeadings(weekStartsOn).map((day) => (
                <span key={day.long} className="pb-2 text-center text-caption text-muted">
                  {day.short}
                </span>
              ))}
            </div>
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <div key={cells[week * 7]} className="grid grid-cols-7">
                {cells.slice(week * 7, week * 7 + 7).map((date) => {
                  const spent = byDay.get(date) ?? 0;
                  const inMonth = date.slice(0, 7) === month;
                  const isSelected = date === selected;
                  const width = inMonth ? spendBarPercent(spent, max) : 0;
                  return (
                    <button
                      key={date}
                      type="button"
                      data-date={date}
                      tabIndex={isSelected ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-label={`${formatLocalDate(date)}, spent ${hidden ? "amount hidden" : formatAmount(spent)}`}
                      onClick={() => setSelected(date)}
                      // Neutral cells with a small mark sized by the day's spend, not a heat fill.
                      className={cx(
                        "flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl py-1 transition-colors duration-150 sm:min-h-16",
                        isSelected ? "bg-ink" : "hover:bg-line/50",
                      )}
                    >
                      <span
                        className={cx(
                          "text-caption tabular",
                          isSelected
                            ? "text-background"
                            : inMonth
                              ? date === today
                                ? "font-extrabold text-ink underline decoration-2 underline-offset-4"
                                : "text-ink"
                              : "text-muted",
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      <span aria-hidden className="flex h-1 w-4/5 justify-center">
                        {width > 0 ? (
                          <span
                            // The bar is the day's only cue, so it uses coral-text (3:1 everywhere).
                            className={cx(
                              "h-1 rounded-full",
                              isSelected ? "bg-background" : "bg-coral-text",
                            )}
                            style={{ width: `${width}%` }}
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <DayList date={selected} spent={insights.data ? (byDay.get(selected) ?? 0) : null} />
      </div>
    </div>
  );
}
