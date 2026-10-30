import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useUserTime } from "@/lib/use-today";
import { useTransactions } from "./queries";
import { TransactionFilterBar } from "./transaction-filter-bar";
import {
  filtersToQuery,
  groupByDay,
  isFiltered,
  type TransactionFilters,
} from "./transaction-filters";
import { TransactionRow, useLookup } from "./transaction-row";

/** Every transaction, newest first in days, with search and filters; pages load on scroll. */
export function TransactionsView({
  filters,
  onFilters,
}: {
  filters: TransactionFilters;
  onFilters: (patch: Partial<TransactionFilters>) => void;
}) {
  const { timeZone } = useUserTime();
  const open = useOpenPanel();
  const lookup = useLookup();
  const query = useTransactions(filtersToQuery(filters, timeZone));
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const days = groupByDay(items, timeZone);
  const filtered = isFiltered(filters);
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
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Transactions"
        back={{ to: "/money", label: "Money" }}
        actions={
          <Button variant="primary" icon={Plus} onClick={add}>
            New
          </Button>
        }
      />
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <aside aria-label="Filters" className="lg:sticky lg:top-0 lg:order-2 lg:self-start">
          <TransactionFilterBar filters={filters} onChange={onFilters} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {query.data === undefined ? (
            query.isError ? (
              <ErrorState onRetry={() => void query.refetch()} />
            ) : (
              <SkeletonRows rows={6} />
            )
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
              <section key={day.date} aria-label={formatLocalDate(day.date, "long")}>
                <h2 className="mb-2 px-1 text-caption text-muted">
                  {formatLocalDate(day.date, "long")}
                </h2>
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
              </section>
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
      </div>
    </div>
  );
}
