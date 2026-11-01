import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useRowKeyActions } from "@/lib/row-keys";
import { remove } from "@/lib/write";
import { DebtForecast, DebtRepay } from "./debt-actions";
import { openDebtGroups, repaidShare, signedOutstanding } from "./debt-groups";
import { RowMenu } from "./money-ui";
import { type Debt, useDebts } from "./queries";

function DebtItem({
  debt,
  repaying,
  onRepay,
}: {
  debt: Debt;
  repaying: boolean;
  onRepay: (open: boolean) => void;
}) {
  const open = useOpenPanel();
  const edit = () => open(`debt:${debt.id}`);
  const drop = () => void remove(`/debts/${debt.id}`, `“${debt.person}”`).catch(() => {});
  useRowKeyActions(`debt:${debt.id}`, { remove: drop });
  const outstanding = signedOutstanding(debt);
  return (
    <div data-row={`debt:${debt.id}`} className="group/row flex flex-col gap-3 px-4 py-3.5">
      {/* Only the summary opens the loan; the forecast and repayment below stay inline. */}
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-row-primary
            onClick={edit}
            className="min-w-0 flex-1 truncate text-left text-body font-bold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-xl after:focus-visible:ring-2 after:focus-visible:ring-sky-text"
          >
            {debt.person}
          </button>
          <Amount
            minor={outstanding}
            currency={debt.currency}
            signed
            tone={outstanding >= 0 ? "in" : "out"}
            className="text-heading"
          />
          <div className="relative z-10">
            <RowMenu
              label={`More for ${debt.person}`}
              items={[
                { label: "Edit", icon: Pencil, onSelect: edit },
                { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
              ]}
            />
          </div>
        </div>
        <ProgressBar
          value={repaidShare(debt.repaidMinor, debt.principalMinor)}
          tone="ink"
          label={`${debt.person} repaid`}
        />
        <p className="text-caption text-muted">
          {formatAmount(debt.repaidMinor, { currency: debt.currency })} of{" "}
          {formatAmount(debt.principalMinor, { currency: debt.currency })} repaid
          {debt.note ? ` · ${debt.note}` : ""}
        </p>
      </div>
      <div className="sm:max-w-xs">
        <DebtForecast debt={debt} />
      </div>
      {repaying ? (
        <div className="flex flex-col gap-2">
          <DebtRepay debt={debt} autoFocus onDone={() => onRepay(false)} />
          <Button size="sm" variant="ghost" className="self-start" onClick={() => onRepay(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" className="self-start" onClick={() => onRepay(true)}>
          Log a repayment
        </Button>
      )}
    </div>
  );
}

/** Who owes me and whom I owe, with partial repayments and a payoff forecast. */
export function DebtsView() {
  const open = useOpenPanel();
  const debts = useDebts();
  const [repaying, setRepaying] = useState<string | null>(null);
  const groups = openDebtGroups(debts.data ?? []);
  const create = () => open("debt:new");
  const empty = groups.every((g) => g.items.length === 0);
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Debts"
        actions={
          <Button size="sm" icon={Plus} onClick={create}>
            New
          </Button>
        }
      />
      {debts.data === undefined ? (
        debts.isError ? (
          <ErrorState onRetry={() => void debts.refetch()} />
        ) : (
          <div className="grid gap-7 lg:grid-cols-2">
            <SkeletonRows rows={2} />
            <SkeletonRows rows={2} />
          </div>
        )
      ) : empty ? (
        <EmptyState
          title="All square"
          message="No loans to track. Note one down so nobody has to remember."
          actionLabel="Add a loan"
          onAction={create}
          mood="relaxed"
        />
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {groups.map((group) =>
            group.items.length ? (
              <Section key={group.title} title={group.title}>
                <Group label={group.title}>
                  {group.items.map((debt) => (
                    <DebtItem
                      key={debt.id}
                      debt={debt}
                      repaying={repaying === debt.id}
                      onRepay={(on) => setRepaying(on ? debt.id : null)}
                    />
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
