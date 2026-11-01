import { describeRRule } from "@tick-taka/shared/recurrence";
import { Pencil, Plus, SkipForward, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { payNeedsRate } from "@/features/today/pay-needs-rate";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useSettings } from "@/lib/queries";
import { remove } from "@/lib/write";
import { billStatusText } from "./bill-status";
import { RowMenu } from "./money-ui";
import { type Recurring, useRecurring } from "./queries";
import { payRecurring } from "./recurring-pay";
import { useSplitOffer } from "./split-offer";
import { SubscriptionSuggestions } from "./subscription-suggestions";

/** "Due soon · Sat 31 Oct · Every month on the 10th"; a late bill names its date once. */
export function recurringSubtitle(item: Recurring): string {
  return [
    item.status === "overdue"
      ? billStatusText(item.status, item.dueDate)
      : [billStatusText(item.status), formatLocalDate(item.dueDate)].filter(Boolean).join(" · "),
    describeRRule(item.rrule),
  ]
    .filter(Boolean)
    .join(" · ");
}

function RecurringRow({ item }: { item: Recurring }) {
  const open = useOpenPanel();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const splitOffer = useSplitOffer();
  const edit = () => open(`recurring:${item.id}`);
  const ref = { id: item.id, name: item.name, dueAt: item.nextDueAt };
  const drop = () => void remove(`/recurring/${item.id}`, `“${item.name}”`).catch(() => {});
  const skip = () => void payRecurring(ref, { skip: true }).catch(() => {});
  const pay = () => {
    // Another currency than the account's: the panel asks for the rate first.
    if (payNeedsRate(item, accounts, settings)) edit();
    else
      void payRecurring(ref, {
        split: splitOffer({ ...item, income: item.kind === "income" }),
      }).catch(() => {});
  };
  const paidLabel = item.kind === "bill" ? "Paid" : "Received";
  return (
    <Row
      dataKey={`recurring:${item.id}`}
      keyActions={{ remove: drop }}
      onClick={edit}
      title={item.name}
      subtitle={recurringSubtitle(item)}
      trailing={
        <>
          <Amount
            minor={item.amountMinor}
            currency={item.currency}
            signed={item.kind === "income"}
            tone={item.kind === "income" ? "in" : undefined}
            className="font-bold"
          />
          <Button size="sm" onClick={pay} aria-label={`${paidLabel}: ${item.name}`}>
            {paidLabel}
          </Button>
          <RowMenu
            label={`More for ${item.name}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: edit },
              { label: "Skip this one", icon: SkipForward, onSelect: skip },
              "separator",
              { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
            ]}
          />
        </>
      }
    />
  );
}

/** Bills and subscriptions, plus salaries and other expected income. */
export function BillsView() {
  const open = useOpenPanel();
  const recurring = useRecurring();
  const list = recurring.data ?? [];
  const groups = [
    { title: "Bills and subscriptions", items: list.filter((r) => r.kind === "bill") },
    { title: "Expected income", items: list.filter((r) => r.kind === "income") },
  ];
  const add = () => open("recurring:new");
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Bills & income"
        actions={
          <Button variant="primary" icon={Plus} onClick={add}>
            New
          </Button>
        }
      />
      <SubscriptionSuggestions />
      {!recurring.data ? (
        recurring.isError ? (
          <ErrorState onRetry={() => void recurring.refetch()} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : list.length === 0 ? (
        <EmptyState
          title="No bills yet"
          message="Add rent, internet or your salary so nothing sneaks up."
          actionLabel="Add a bill"
          onAction={add}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-2 lg:items-start">
          {groups.map((group) =>
            group.items.length ? (
              <Section key={group.title} title={group.title}>
                <Group>
                  {group.items.map((item) => (
                    <RecurringRow key={item.id} item={item} />
                  ))}
                </Group>
              </Section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
