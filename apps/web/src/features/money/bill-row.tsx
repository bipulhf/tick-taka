import { describeRRule } from "@tick-taka/shared/recurrence";
import { Pencil, SkipForward, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/group";
import { StatusPill } from "@/components/ui/status-pill";
import { payNeedsRate } from "@/features/today/pay-needs-rate";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { billPill } from "./bill-groups";
import { billStatusText } from "./bill-status";
import { RowMenu } from "./money-ui";
import type { Recurring } from "./queries";
import { payRecurring } from "./recurring-pay";
import { useSplitOffer } from "./split-offer";

/**
 * One bill or income: a calm pill for its state, when it's due and how often, the
 * amount, and Paid / Received (with Undo). `settled` says this month's is logged.
 */
export function BillRow({ item, settled }: { item: Recurring; settled: boolean }) {
  const open = useOpenPanel();
  const today = useTodayDate();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const splitOffer = useSplitOffer();
  const isBill = item.kind === "bill";
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
  const paidLabel = isBill ? "Paid" : "Received";
  const pill = billPill(item, settled, today);
  // A late bill's pill names its date, and "Due today" is one: say it once.
  const when =
    pill === "overdue" || pill === "due_today"
      ? describeRRule(item.rrule)
      : `${formatLocalDate(item.dueDate)} · ${describeRRule(item.rrule)}`;
  return (
    <Row
      as="li"
      dataKey={`recurring:${item.id}`}
      keyActions={{ remove: drop }}
      onClick={edit}
      title={item.name}
      subtitle={
        <span className="flex min-w-0 items-center gap-x-2 gap-y-1 pt-0.5 max-sm:flex-wrap">
          {pill ? (
            <StatusPill status={pill} className="max-w-full">
              {pill === "overdue" ? (
                <span className="min-w-0 truncate">
                  {billStatusText(item.status, item.dueDate)}
                </span>
              ) : pill === "paid" ? (
                paidLabel
              ) : undefined}
            </StatusPill>
          ) : null}
          <span className="max-w-full truncate">{when}</span>
        </span>
      }
      trailing={
        <>
          <Button size="sm" onClick={pay} aria-label={`${paidLabel}: ${item.name}`}>
            {paidLabel}
          </Button>
          <Amount
            minor={item.amountMinor}
            currency={item.currency}
            signed={!isBill}
            tone={isBill ? undefined : "in"}
            animate={false}
            className="text-right font-bold sm:min-w-20"
          />
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
