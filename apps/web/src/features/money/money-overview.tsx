import { Link } from "@tanstack/react-router";
import { ArrowUpDown, Minus, Plus } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section, SectionAction } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useSettings } from "@/lib/queries";
import { AccountRows } from "./account-rows";
import { BudgetsAtAGlance, MoneyMore, MoneyShortcuts } from "./money-overview-parts";
import { useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

/**
 * Money: the total across accounts as the one big number, Expense and Income, the
 * accounts; beside them on a desk this month's budgets and what moved recently.
 */
export function MoneyOverview() {
  const { data: settings } = useSettings();
  const accounts = useAccounts();
  const recent = useTransactions({ limit: "6" });
  const lookup = useLookup();
  const open = useOpenPanel();
  const list = accounts.data ?? [];
  const currency = settings?.defaultCurrency ?? "BDT";
  const total = list
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  const items = recent.data?.pages.flatMap((p) => p.items) ?? [];
  const log = (type: "expense" | "income") => open("transaction:new", { type });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Money" />
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-7">
          <section aria-label="All accounts" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 px-1">
              <span className="text-callout text-muted">All accounts</span>
              {accounts.data ? (
                <Amount minor={total} currency={currency} className="text-hero" />
              ) : (
                <Skeleton className="mt-1 h-12 w-1/2 rounded-2xl" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button icon={Minus} size="lg" onClick={() => log("expense")}>
                Expense
              </Button>
              <Button icon={Plus} size="lg" onClick={() => log("income")}>
                Income
              </Button>
            </div>
            <MoneyShortcuts />
          </section>
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
          <div className="hidden lg:block">
            <Section title="More" id="money-more">
              <MoneyMore />
            </Section>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <Section
            title="This month's budgets"
            id="money-budgets"
            action={
              <Link
                to="/money/budgets"
                className="rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
              >
                Budgets
              </Link>
            }
          >
            <BudgetsAtAGlance />
          </Section>
          <Section
            title="Recent"
            id="money-recent"
            action={
              <Link
                to="/money/transactions"
                className="rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
              >
                All
              </Link>
            }
          >
            {recent.data === undefined ? (
              recent.isError ? (
                <ErrorState onRetry={() => void recent.refetch()} />
              ) : (
                <SkeletonRows rows={4} />
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
          <div className="lg:hidden">
            <Section title="More" id="money-more-narrow">
              <MoneyMore />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
