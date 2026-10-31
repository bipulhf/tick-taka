import { useNavigate } from "@tanstack/react-router";
import { BanknoteArrowUp, Handshake, Receipt } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Section, SectionAction } from "@/components/ui/section";
import { billStatusText } from "@/features/money/bill-status";
import { payRecurring } from "@/features/money/recurring-pay";
import { useSplitOffer } from "@/features/money/split-offer";
import { formatClock, formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { type TodayData, useAccounts, useSettings } from "@/lib/queries";
import { useUserTime } from "@/lib/use-today";
import { payNeedsRate } from "./pay-needs-rate";

type Item = TodayData["timeline"][number];
type MoneyItem = Extract<Item, { kind: "bill" | "payday" }>;

function MoneyRow({ item }: { item: MoneyItem }) {
  const open = useOpenPanel();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const [paying, setPaying] = useState(false);
  const splitOffer = useSplitOffer();
  const isBill = item.kind === "bill";
  const openItem = () => open(`recurring:${item.id}`);
  return (
    <Row
      as="li"
      dataKey={`recurring:${item.id}`}
      leading={
        <RowMark icon={isBill ? Receipt : BanknoteArrowUp} tone={isBill ? "coral" : "mint"} />
      }
      title={item.name}
      subtitle={
        item.overdue ? billStatusText("overdue", item.dueDate) : isBill ? "Due today" : "Payday"
      }
      onClick={openItem}
      trailing={
        <Button
          size="sm"
          loading={paying}
          onClick={async () => {
            // A foreign-currency bill or payday needs its rate, which the panel asks for.
            if (payNeedsRate(item, accounts, settings)) return openItem();
            setPaying(true);
            await payRecurring(item, {
              split: splitOffer({ ...item, income: !isBill }),
            }).catch(() => {});
            setPaying(false);
          }}
        >
          {isBill ? "Paid" : "Received"}
        </Button>
      }
    />
  );
}

/**
 * Bills, paydays and debts due today, and the next bill after them: the money half
 * of what's coming. Paid and Received log it in one click, with Undo.
 */
export function MoneyDue({ data }: { data: TodayData }) {
  const navigate = useNavigate();
  const { timeZone } = useUserTime();
  const items = data.timeline.filter(
    (item): item is Exclude<Item, { kind: "task" }> => item.kind !== "task",
  );
  const nextBill = data.upcoming[0];
  if (items.length === 0 && !nextBill) return null;
  return (
    <Section
      title="Bills and income"
      id="today-money-due"
      action={
        <SectionAction onClick={() => void navigate({ to: "/money/bills" })}>All</SectionAction>
      }
    >
      <Group as="ul" label="Bills and income">
        {items.map((item) =>
          item.kind === "debt" ? (
            <Row
              as="li"
              key={`debt-${item.id}`}
              leading={<RowMark icon={Handshake} />}
              title={
                item.direction === "owed_to_me"
                  ? `${item.person} owes you`
                  : `You owe ${item.person}`
              }
              subtitle={formatClock(item.at, timeZone)}
              trailing={
                <Amount minor={item.principalMinor} animate={false} className="font-bold" />
              }
              onClick={() => void navigate({ to: "/money/debts" })}
            />
          ) : (
            <MoneyRow key={`${item.kind}-${item.id}`} item={item} />
          ),
        )}
        {nextBill ? (
          <Row
            as="li"
            key="next-bill"
            leading={
              <RowMark
                icon={nextBill.kind === "bill" ? Receipt : BanknoteArrowUp}
                tone={nextBill.kind === "bill" ? "coral" : "mint"}
              />
            }
            title={nextBill.name}
            subtitle={
              <>
                {formatLocalDate(nextBill.dueDate)} ·{" "}
                <Amount minor={nextBill.amountMinor} currency={nextBill.currency} animate={false} />
              </>
            }
            chevron
            onClick={() => void navigate({ to: "/money/bills" })}
          />
        ) : null}
      </Group>
    </Section>
  );
}
