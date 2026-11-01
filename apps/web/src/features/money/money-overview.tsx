import { Link } from "@tanstack/react-router";
import { localMonthRange } from "@tick-taka/shared/dates";
import { ArrowUpDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section, SectionAction } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { SafeToSpendCard } from "@/features/today/safe-to-spend-card";
import { formatMonth } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useSettings } from "@/lib/queries";
import { useThisMonth, useToday, useUserTime } from "@/lib/use-today";
import { AccountRows } from "./account-rows";
import { ComingUp, SpendingThisMonth } from "./money-overview-parts";
import { useInsights, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

const LINK = "rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10";

/**
 * Money: a dashboard for the month. Net worth with this month's in, out and net; then
 * safe to spend and what's coming up, where the money went, the accounts and what
 * moved recently. Three columns on a wide desk, two on a smaller one, one on a phone.
 */
export function MoneyOverview() {
  const { data: settings } = useSettings();
  const { timeZone } = useUserTime();
  const thisMonth = useThisMonth();
  const range = localMonthRange(thisMonth, timeZone);
  const accounts = useAccounts();
  const insights = useInsights(range.from, range.to);
  const today = useToday();
  const recent = useTransactions({ limit: "6" });
  const lookup = useLookup();
  const open = useOpenPanel();
  const list = accounts.data ?? [];
  const currency = settings?.defaultCurrency ?? "BDT";
  const total = list
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  const totals = insights.data?.totals;
  const items = recent.data?.pages.flatMap((p) => p.items) ?? [];
  const log = (type: "expense" | "income") => open("transaction:new", { type });
  const month = formatMonth(thisMonth);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Money"
        actions={
          <Button icon={Plus} onClick={() => log("income")}>
            Income
          </Button>
        }
        primary={{ label: "New expense", icon: Minus, onClick: () => log("expense") }}
        summary={
          <SummaryStrip label="Your money" layout="lead">
            <StatTile
              size="lead"
              label="Net worth"
              minor={total}
              currency={currency}
              caption="All accounts"
              loading={!accounts.data}
            />
            <StatTile
              label="In this month"
              tone="in"
              minor={totals?.incomeMinor}
              caption={month}
              loading={!totals}
            />
            <StatTile
              label="Out this month"
              tone="out"
              minor={totals?.spentMinor}
              caption={month}
              loading={!totals}
            />
            <StatTile
              label="Net this month"
              tone="flow"
              minor={totals?.netMinor}
              caption="In minus out"
              loading={!totals}
            />
          </SummaryStrip>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-7">
          <section aria-label="Safe to spend">
            {today.data ? (
              <SafeToSpendCard data={today.data} />
            ) : (
              <Skeleton className="h-48 rounded-3xl" />
            )}
          </section>
          <ComingUp />
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <SpendingThisMonth
            rows={insights.data?.spendingByCategory}
            failed={insights.isError}
            onRetry={() => void insights.refetch()}
          />
          <Section
            title="Accounts"
            id="money-accounts"
            action={<SectionAction onClick={() => open("account:new")}>Add</SectionAction>}
          >
            {accounts.data === undefined ? (
              accounts.isError ? (
                <ErrorState onRetry={() => void accounts.refetch()} />
              ) : (
                <SkeletonRows rows={3} />
              )
            ) : list.length === 0 ? (
              <EmptyState
                title="No accounts yet"
                message="Add where your money lives: cash, bKash, bank, cards."
                actionLabel="Add an account"
                onAction={() => open("account:new")}
              />
            ) : (
              <AccountRows accounts={list} opens="transactions" />
            )}
          </Section>
        </div>
        <Section
          title="Recent"
          id="money-recent"
          className="min-w-0 lg:col-span-2 xl:col-span-1"
          action={
            <Link to="/money/transactions" className={LINK}>
              All
            </Link>
          }
        >
          {recent.data === undefined ? (
            recent.isError ? (
              <ErrorState onRetry={() => void recent.refetch()} />
            ) : (
              <SkeletonRows rows={6} />
            )
          ) : items.length === 0 ? (
            <EmptyState
              icon={ArrowUpDown}
              title="No transactions yet"
              message="Log one in seconds: try “lunch 250” in quick-add, or tell Tiki."
              actionLabel="Add one"
              onAction={() => log("expense")}
            />
          ) : (
            <Group>
              {items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} lookup={lookup} />
              ))}
            </Group>
          )}
        </Section>
      </div>
    </div>
  );
}
