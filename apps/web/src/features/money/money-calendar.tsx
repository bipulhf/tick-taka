import { localMonthRange } from "@tick-taka/shared/dates";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatLocalDate, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { monthCells, spendBarPercent, stepDay, weekdayHeadings } from "./calendar-cells";
import { useInsights } from "./queries";

/**
 * Transactions' month view: a grid of daily spending; pick a spike to see what it was
 * (the list below shows that day). `selected` is the picked day, if any; `onSelect`
 * also gets the month to show, which changes only when the arrows leave the grid.
 */
export function SpendingMonth({
  month,
  selected,
  onSelect,
  onAllDays,
}: {
  month: string;
  selected: string | undefined;
  onSelect: (date: string, month: string) => void;
  onAllDays: () => void;
}) {
  const { timeZone, weekStartsOn } = useUserTime();
  const hidden = usePrivacy();
  const today = useTodayDate();
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

  // With no day picked, today (or the 1st) is where Tab lands and the arrows start.
  const focusDate =
    selected ??
    (today.slice(0, 7) === month ? today : (cells.find((d) => d.startsWith(month)) ?? today));
  const onKeyDown = (event: KeyboardEvent) => {
    const next = stepDay(focusDate, event.key);
    if (!next) return;
    event.preventDefault();
    moved.current = true;
    onSelect(next, next.slice(0, 7) !== month && !cells.includes(next) ? next.slice(0, 7) : month);
  };
  const spentShown = insights.data
    ? selected
      ? (byDay.get(selected) ?? 0)
      : insights.data.totals.spentMinor
    : null;

  return (
    <div className="flex flex-col gap-3">
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
                    tabIndex={date === focusDate ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={`${formatLocalDate(date)}, spent ${hidden ? "amount hidden" : formatAmount(spent)}`}
                    onClick={() => onSelect(date, month)}
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
      {/* The picked day's (or the month's) spend at a readable size, instead of a figure in every cell. */}
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="text-heading">
          {selected ? formatLocalDate(selected, "long") : formatMonth(month)}
          {spentShown !== null ? (
            <span className="ml-2 text-callout font-normal text-muted">
              Spent <Amount minor={spentShown} animate={false} className="font-bold text-ink" />
            </span>
          ) : null}
        </h2>
        {selected ? (
          <Button size="sm" variant="ghost" onClick={onAllDays}>
            All days
          </Button>
        ) : null}
      </div>
    </div>
  );
}
