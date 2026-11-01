import { toLocalDate } from "@tick-taka/shared/dates";
import { HandCoins, Pencil, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { FoldedSection } from "@/components/ui/folded-section";
import { Group, Row } from "@/components/ui/group";
import { ItemCard } from "@/components/ui/item-card";
import { ProgressBar } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useUserTime } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { DebtRepay } from "./debt-actions";
import { repaidShare, signedOutstanding } from "./debt-groups";
import { RowMenu } from "./money-ui";
import type { Debt } from "./queries";

function useDebtActions(debt: Debt) {
  const open = useOpenPanel();
  const edit = () => open(`debt:${debt.id}`);
  const drop = () => void remove(`/debts/${debt.id}`, `“${debt.person}”`).catch(() => {});
  const menu = (
    <RowMenu
      label={`More for ${debt.person}`}
      items={[
        { label: "Edit", icon: Pencil, onSelect: edit },
        { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
      ]}
    />
  );
  return { edit, drop, menu };
}

/**
 * One open loan: who, what's still outstanding (with its sign), repaid of the total
 * with a bar, the reminder if there is one, and Log a repayment. The payoff forecast
 * lives in the loan's panel, which the card opens.
 */
export function DebtCard({
  debt,
  repaying,
  onRepay,
}: {
  debt: Debt;
  repaying: boolean;
  onRepay: (open: boolean) => void;
}) {
  const { timeZone } = useUserTime();
  const { edit, drop, menu } = useDebtActions(debt);
  const outstanding = signedOutstanding(debt);
  const reminder = debt.remindAt ?? debt.dueAt;
  return (
    <ItemCard
      dataKey={`debt:${debt.id}`}
      keyActions={{ remove: drop }}
      onOpen={edit}
      title={debt.person}
      subtitle={debt.note || (debt.direction === "owed_to_me" ? "You lent" : "You borrowed")}
      aside={
        <Amount
          minor={outstanding}
          currency={debt.currency}
          signed
          tone={outstanding >= 0 ? "in" : "out"}
          animate={false}
          className="text-heading"
        />
      }
      menu={menu}
      actions={
        repaying ? (
          <>
            <DebtRepay debt={debt} autoFocus secondary onDone={() => onRepay(false)} />
            <Button size="sm" variant="ghost" className="self-start" onClick={() => onRepay(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" icon={HandCoins} className="self-start" onClick={() => onRepay(true)}>
            Log a repayment
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <ProgressBar
          value={repaidShare(debt.repaidMinor, debt.principalMinor)}
          tone="ink"
          label={`${debt.person} repaid`}
        />
        <p className="flex flex-wrap justify-between gap-x-3 text-callout text-muted">
          <span>
            <Amount
              minor={debt.repaidMinor}
              currency={debt.currency}
              animate={false}
              className="font-bold text-ink"
            />{" "}
            of <Amount minor={debt.principalMinor} currency={debt.currency} animate={false} />{" "}
            repaid
          </span>
          {reminder ? (
            <span className="text-sky-text">
              Reminder {formatLocalDate(toLocalDate(reminder, timeZone))}
            </span>
          ) : null}
        </p>
      </div>
    </ItemCard>
  );
}

function SettledRow({ debt }: { debt: Debt }) {
  const { timeZone } = useUserTime();
  const { edit, drop, menu } = useDebtActions(debt);
  return (
    <Row
      as="li"
      dataKey={`debt:${debt.id}`}
      keyActions={{ remove: drop }}
      onClick={edit}
      title={debt.person}
      subtitle={
        <>
          {debt.direction === "owed_to_me" ? "Lent" : "Borrowed"}{" "}
          <Amount minor={debt.principalMinor} currency={debt.currency} animate={false} />
          {debt.closedAt
            ? ` · settled ${formatLocalDate(toLocalDate(debt.closedAt, timeZone))}`
            : ""}
        </>
      }
      trailing={
        <>
          <StatusPill status="paid">Settled</StatusPill>
          {menu}
        </>
      }
    />
  );
}

/** Settled loans, folded away at the end. */
export function SettledDebts({ debts }: { debts: Debt[] }) {
  if (debts.length === 0) return null;
  return (
    <FoldedSection title="Settled" count={debts.length} caption="All square. Kept for the record.">
      <Group as="ul" label="Settled loans">
        {debts.map((debt) => (
          <SettledRow key={debt.id} debt={debt} />
        ))}
      </Group>
    </FoldedSection>
  );
}
