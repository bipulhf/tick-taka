import { localMonthRange } from "@tick-taka/shared/dates";
import { BanknoteArrowUp, Plus, Receipt } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMonth, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { useThisMonth, useTodayDate, useUserTime } from "@/lib/use-today";
import {
  groupBills,
  groupTotal,
  type MonthSettled,
  monthAhead,
  settledThisMonth,
} from "./bill-groups";
import { BillRow } from "./bill-row";
import { type Recurring, useRecurring, useTransactionsForSummary } from "./queries";
import { SubscriptionSuggestions } from "./subscription-suggestions";
import { useLookup } from "./transaction-row";

/** One column of the page (bills, or income), grouped by when each is due. */
function BillColumn({
  kind,
  items,
  settled,
}: {
  kind: "bill" | "income";
  items: Recurring[];
  settled: MonthSettled | undefined;
}) {
  const open = useOpenPanel();
  const today = useTodayDate();
  const { data: settings } = useSettings();
  const currency = settings?.defaultCurrency ?? "BDT";
  const isBill = kind === "bill";
  const title = isBill ? "Bills and subscriptions" : "Expected income";
  return (
    <Section title={title} id={`bills-${kind}`} className="min-w-0">
      {items.length === 0 ? (
        isBill ? (
          <EmptyState
            icon={Receipt}
            title="No bills yet"
            message="Add rent, internet or a subscription so nothing sneaks up."
            actionLabel="Add a bill"
            onAction={() => open("recurring:new")}
          />
        ) : (
          <EmptyState
            icon={BanknoteArrowUp}
            title="No income yet"
            message="Add your salary so paydays show up here."
            actionLabel="Add income"
            onAction={() => open("recurring:new", { kind: "income" })}
          />
        )
      ) : (
        <div className="flex flex-col gap-5">
          {groupBills(items, today).map((group) => (
            <ListSection
              key={group.key}
              id={`bills-${kind}-${group.key}`}
              title={group.title}
              total={
                <Amount
                  minor={groupTotal(group.items, currency)}
                  currency={currency}
                  signed={!isBill}
                  tone={isBill ? undefined : "in"}
                  animate={false}
                />
              }
            >
              <Group as="ul" label={`${title}, ${group.title}`}>
                {group.items.map((item) => (
                  <BillRow key={item.id} item={item} settled={Boolean(settled?.ids.has(item.id))} />
                ))}
              </Group>
            </ListSection>
          ))}
        </div>
      )}
    </Section>
  );
}

/**
 * Bills and subscriptions, plus salaries and other expected income: this month at a
 * glance (due, paid, still to pay, expected income), then each column grouped by when
 * it's due, with Paid / Received on every row.
 */
export function BillsView() {
  const open = useOpenPanel();
  const recurring = useRecurring();
  const today = useTodayDate();
  const thisMonth = useThisMonth();
  const { timeZone } = useUserTime();
  const { data: settings } = useSettings();
  const lookup = useLookup();
  const currency = settings?.defaultCurrency ?? "BDT";
  const range = localMonthRange(thisMonth, timeZone);
  const month = useTransactionsForSummary({ from: String(range.from), to: String(range.to) });
  const settled = month.data
    ? settledThisMonth(
        month.data.items,
        (tx) => (lookup.account(tx.accountId)?.currency ?? currency) === currency,
      )
    : undefined;
  const list = recurring.data ?? [];
  const bills = list.filter((r) => r.kind === "bill");
  const income = list.filter((r) => r.kind === "income");
  const ahead = monthAhead(list, today, currency);
  const add = () => open("recurring:new");
  const monthName = formatMonth(thisMonth);
  const loading = !recurring.data || !settled;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Bills & income"
        primary={{ label: "New bill", icon: Plus, onClick: add }}
        summary={
          recurring.data?.length === 0 ? undefined : (
            <SummaryStrip label={`Bills and income, ${monthName}`}>
              <StatTile
                label="Due this month"
                minor={(settled?.paidMinor ?? 0) + ahead.stillToPayMinor}
                currency={currency}
                caption={monthName}
                loading={loading}
              />
              <StatTile
                label="Paid so far"
                tone="out"
                minor={settled?.paidMinor}
                currency={currency}
                caption={
                  settled?.paidCount ? `${plural(settled.paidCount, "bill")} paid` : "Nothing yet"
                }
                loading={loading}
              />
              <StatTile
                label="Still to pay"
                minor={ahead.stillToPayMinor}
                currency={currency}
                caption={ahead.billsLeft ? `${plural(ahead.billsLeft, "bill")} left` : "All paid"}
                loading={loading}
              />
              <StatTile
                label="Expected income"
                tone="in"
                minor={ahead.expectedMinor}
                currency={currency}
                caption={
                  settled?.receivedMinor ? (
                    <>
                      <Amount minor={settled.receivedMinor} currency={currency} animate={false} />{" "}
                      received
                    </>
                  ) : (
                    monthName
                  )
                }
                loading={loading}
              />
            </SummaryStrip>
          )
        }
      />
      {!recurring.data ? (
        recurring.isError ? (
          <ErrorState onRetry={() => void recurring.refetch()} />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 xl:grid-cols-2">
            <SkeletonRows rows={4} />
            <SkeletonRows rows={2} />
          </div>
        )
      ) : list.length === 0 ? (
        <>
          <EmptyState
            title="No bills yet"
            message="Add rent, internet or your salary so nothing sneaks up."
            actionLabel="Add a bill"
            onAction={add}
          />
          <SubscriptionSuggestions />
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 xl:grid-cols-2">
          <BillColumn kind="bill" items={bills} settled={settled} />
          <div className="flex min-w-0 flex-col gap-7">
            <BillColumn kind="income" items={income} settled={settled} />
            <SubscriptionSuggestions />
          </div>
        </div>
      )}
    </div>
  );
}
