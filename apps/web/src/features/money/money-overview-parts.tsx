import { Link } from "@tanstack/react-router";
import { BanknoteArrowUp, CalendarCheck, PieChart, Receipt } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { BarList } from "@/features/review/charts/bar-list";
import { rollUpByParent } from "@/features/review/insights-data";
import { payNeedsRate } from "@/features/today/pay-needs-rate";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { billStatusText } from "./bill-status";
import { comingUp, comingUpNet, topWithOther } from "./overview-data";
import { type Recurring, useRecurring } from "./queries";
import { payRecurring } from "./recurring-pay";
import { useSplitOffer } from "./split-offer";

const LINK = "rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10";

/** One bill or payday: when, a calm status, the amount and Paid / Received with Undo. */
function ComingUpRow({ item }: { item: Recurring }) {
  const open = useOpenPanel();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const splitOffer = useSplitOffer();
  const [paying, setPaying] = useState(false);
  const isBill = item.kind === "bill";
  const edit = () => open(`recurring:${item.id}`);
  const pay = async () => {
    // Another currency than the account's: the panel asks for the rate first.
    if (payNeedsRate(item, accounts, settings)) return edit();
    setPaying(true);
    await payRecurring(
      { id: item.id, name: item.name, dueAt: item.nextDueAt },
      { split: splitOffer({ ...item, income: !isBill }) },
    ).catch(() => {});
    setPaying(false);
  };
  const paidLabel = isBill ? "Paid" : "Received";
  return (
    <Row
      as="li"
      dataKey={`recurring:${item.id}`}
      onClick={edit}
      leading={
        <RowMark icon={isBill ? Receipt : BanknoteArrowUp} tone={isBill ? "coral" : "mint"} />
      }
      title={item.name}
      subtitle={
        // A calm word for its state with the date in it, so a narrow column keeps both.
        item.status === "upcoming" ? (
          formatLocalDate(item.dueDate)
        ) : (
          <StatusPill status={item.status}>
            {item.status === "due_soon"
              ? `Due ${formatLocalDate(item.dueDate)}`
              : billStatusText(item.status, item.dueDate)}
          </StatusPill>
        )
      }
      trailing={
        <>
          <Amount
            minor={item.amountMinor}
            currency={item.currency}
            signed={!isBill}
            tone={isBill ? undefined : "in"}
            animate={false}
            className="font-bold"
          />
          <Button
            size="sm"
            loading={paying}
            onClick={() => void pay()}
            aria-label={`${paidLabel}: ${item.name}`}
          >
            {paidLabel}
          </Button>
        </>
      }
    />
  );
}

/** Bills and paydays in the next seven days (and any late ones), with their net. */
export function ComingUp() {
  const recurring = useRecurring();
  const today = useTodayDate();
  const open = useOpenPanel();
  const { data: settings } = useSettings();
  const currency = settings?.defaultCurrency ?? "BDT";
  const items = recurring.data ? comingUp(recurring.data, today) : [];
  return (
    <ListSection
      id="money-coming-up"
      variant="heading"
      align="edge"
      title="Coming up"
      caption="Bills and paydays, next 7 days"
      total={
        items.length ? (
          <Amount
            minor={comingUpNet(items, currency)}
            currency={currency}
            signed
            tone="flow"
            animate={false}
          />
        ) : undefined
      }
    >
      {!recurring.data ? (
        recurring.isError ? (
          <ErrorState onRetry={() => void recurring.refetch()} />
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing due this week"
          message="Bills and paydays for the next 7 days show up here."
          actionLabel="Add a bill"
          onAction={() => open("recurring:new")}
        />
      ) : (
        <Group as="ul" label="Coming up">
          {items.map((item) => (
            <ComingUpRow key={item.id} item={item} />
          ))}
        </Group>
      )}
    </ListSection>
  );
}

/** This month's spending by category: the top five as bars, the rest as Other. */
export function SpendingThisMonth({
  rows,
  failed,
  onRetry,
}: {
  /** The month's insights `spendingByCategory`, undefined while it loads. */
  rows: { categoryId: string | null; amountMinor: number }[] | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const entries = rows ? topWithOther(rollUpByParent(rows, categories)) : [];
  const name = (id: string | null) => {
    const category = categories.find((c) => c.id === id);
    return category ? `${category.emoji} ${category.name}` : "Uncategorised";
  };
  return (
    <Section
      title="Spending this month"
      id="money-spending"
      action={
        <Link to="/review/reports" className={LINK}>
          Reports
        </Link>
      }
    >
      {!rows ? (
        failed ? (
          <ErrorState onRetry={onRetry} />
        ) : (
          <Skeleton className="h-56 rounded-2xl" />
        )
      ) : entries.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No spending yet this month"
          message="What you spend this month shows up here, biggest first."
        />
      ) : (
        <div className="rounded-2xl bg-card p-5">
          <BarList
            label="Spending by category this month"
            tone="coral"
            items={entries.map((entry) => ({
              key: entry.other ? "other" : (entry.id ?? "none"),
              label: entry.other ? "Other" : name(entry.id),
              value: entry.amountMinor,
              valueText: <Amount minor={entry.amountMinor} animate={false} />,
            }))}
          />
        </div>
      )}
    </Section>
  );
}
