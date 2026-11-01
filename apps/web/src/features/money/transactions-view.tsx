import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatLocalDate, formatMonth } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { useThisMonth, useUserTime } from "@/lib/use-today";
import { SpendingMonth } from "./money-calendar";
import { useTransactions, useTransactionsForSummary } from "./queries";
import { TransactionFilterBar } from "./transaction-filter-bar";
import {
  filtersToQuery,
  groupByDay,
  isFiltered,
  type TransactionFilters,
  type TransactionsLayout,
} from "./transaction-filters";
import { TransactionRow, useLookup } from "./transaction-row";
import { dayNet, type SummaryItem, summarizeTransactions } from "./transaction-summary";

const LAYOUTS: { value: TransactionsLayout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "month", label: "Month" },
];

/**
 * Every transaction, newest first in days with each day's net, under a summary of what
 * the filter shows (spent, earned, net, count) and one toolbar of filters; pages load
 * on scroll. "Month" puts a grid of daily spending beside the list; picking a day
 * there filters the list to it.
 */
export function TransactionsView({
  filters,
  onFilters,
  layout,
  onLayout,
}: {
  filters: TransactionFilters;
  onFilters: (patch: Partial<TransactionFilters>) => void;
  layout: TransactionsLayout;
  onLayout: (layout: TransactionsLayout) => void;
}) {
  const { timeZone } = useUserTime();
  const thisMonth = useThisMonth();
  const open = useOpenPanel();
  const lookup = useLookup();
  // The grid shows the month filter's month (this month without one), and so does the list.
  const gridMonth = filters.month ?? thisMonth;
  const shown = layout === "month" ? { ...filters, month: gridMonth } : filters;
  const apiQuery = filtersToQuery(shown, timeZone);
  const query = useTransactions(apiQuery);
  const summary = useTransactionsForSummary(apiQuery);
  const { data: settings } = useSettings();
  const currency = settings?.defaultCurrency ?? "BDT";
  const inCurrency = (item: SummaryItem) =>
    (lookup.account(item.accountId)?.currency ?? currency) === currency;
  const totals = summary.data ? summarizeTransactions(summary.data.items, inCurrency) : undefined;
  const period = shown.day
    ? formatLocalDate(shown.day, "long")
    : shown.month
      ? formatMonth(shown.month)
      : "All time";
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const days = groupByDay(items, timeZone);
  const filtered = isFiltered(shown);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const add = () => open("transaction:new");
  const monthView = layout === "month";
  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      {query.data === undefined ? (
        query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <SkeletonRows rows={6} />
        )
      ) : days.length === 0 &&
        filters.day &&
        !isFiltered({ ...filters, day: undefined, month: undefined }) ? (
        <EmptyState
          title="Nothing logged this day"
          message="A quiet day for your wallet. Pick another day to see where money moved."
          mood="relaxed"
        />
      ) : days.length === 0 && monthView && !isFiltered({ ...filters, month: undefined }) ? (
        <EmptyState
          title="Nothing logged this month"
          message="Pick another month, or log something and it shows up here."
          mood="relaxed"
        />
      ) : days.length === 0 ? (
        <EmptyState
          title={filtered ? "No matches" : "No transactions yet"}
          message={
            filtered
              ? "No transactions match. Try another search or clear a filter."
              : "Log one in seconds and your history starts here."
          }
          actionLabel="Add one"
          onAction={add}
        />
      ) : (
        days.map((day) => (
          <ListSection
            key={day.date}
            id={`day-${day.date}`}
            title={formatLocalDate(day.date, "long")}
            total={
              <Amount
                minor={dayNet(day.items, inCurrency, filters.accountId)}
                currency={currency}
                signed
                animate={false}
              />
            }
          >
            <Group>
              {day.items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  lookup={lookup}
                  perspectiveAccountId={filters.accountId}
                  timeOnly
                />
              ))}
            </Group>
          </ListSection>
        ))
      )}
      <div ref={sentinel} />
      {hasNextPage ? (
        <Button
          className="self-center"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Transactions"
        actions={
          <>
            {monthView ? (
              <MonthStepper
                month={gridMonth}
                onChange={(month) => onFilters({ month, day: undefined })}
              />
            ) : null}
            <Segmented label="Show" options={LAYOUTS} value={layout} onChange={onLayout} />
          </>
        }
        primary={{ label: "New transaction", icon: Plus, onClick: add }}
        summary={
          <SummaryStrip label="What this list shows">
            <StatTile
              label="Spent"
              tone="out"
              minor={totals?.spentMinor}
              currency={currency}
              caption={period}
              loading={!totals}
            />
            <StatTile
              label="Earned"
              tone="in"
              minor={totals?.earnedMinor}
              currency={currency}
              caption={period}
              loading={!totals}
            />
            <StatTile
              label="Net"
              tone="flow"
              minor={totals?.netMinor}
              currency={currency}
              caption="Earned minus spent"
              loading={!totals}
            />
            <StatTile
              label="Count"
              value={totals ? `${totals.count}${summary.data?.capped ? "+" : ""}` : undefined}
              caption={
                summary.data?.capped
                  ? "Totals cover the latest 1,000"
                  : totals?.count === 1
                    ? "transaction"
                    : "transactions"
              }
              loading={!totals}
            />
          </SummaryStrip>
        }
      />
      <TransactionFilterBar filters={filters} onChange={onFilters} monthView={monthView} />
      {monthView ? (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 xl:grid-cols-2">
          <div className="xl:sticky xl:top-4">
            <SpendingMonth
              month={gridMonth}
              selected={filters.day}
              onSelect={(day, month) => onFilters({ day, month })}
              onAllDays={() => onFilters({ day: undefined })}
            />
          </div>
          {list}
        </div>
      ) : (
        list
      )}
    </div>
  );
}
