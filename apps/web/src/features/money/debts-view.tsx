import { Plus } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardGrid, ItemCardSkeletons } from "@/components/ui/item-card";
import { ListSection } from "@/components/ui/list-section";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { DebtCard, SettledDebts } from "./debt-card";
import { debtTotals, openDebtGroups, settledDebts } from "./debt-groups";
import { useDebts } from "./queries";

/**
 * Who owes me and whom I owe: the totals and the net first, then a card per loan with
 * partial repayments; settled loans fold away at the end.
 */
export function DebtsView() {
  const open = useOpenPanel();
  const debts = useDebts();
  const { data: settings } = useSettings();
  const [repaying, setRepaying] = useState<string | null>(null);
  const currency = settings?.defaultCurrency ?? "BDT";
  const list = debts.data ?? [];
  const groups = openDebtGroups(list);
  const settled = settledDebts(list);
  const totals = debtTotals(list, currency);
  const [owedToMe, iOwe] = groups.map((g) => g.items.length);
  const create = () => open("debt:new");
  const empty = groups.every((g) => g.items.length === 0);
  const loading = !debts.data;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Debts"
        primary={{ label: "New debt", icon: Plus, onClick: create }}
        summary={
          debts.data?.length === 0 ? undefined : (
            <SummaryStrip label="Loans">
              <StatTile
                label="Owed to me"
                tone="in"
                minor={totals.owedToMeMinor}
                currency={currency}
                caption={owedToMe ? `From ${plural(owedToMe, "person", "people")}` : "Nobody"}
                loading={loading}
              />
              <StatTile
                label="I owe"
                tone="out"
                minor={totals.iOweMinor}
                currency={currency}
                caption={iOwe ? `To ${plural(iOwe, "person", "people")}` : "Nobody"}
                loading={loading}
              />
              <StatTile
                label="Net"
                tone="flow"
                minor={totals.netMinor}
                currency={currency}
                caption="Owed to me minus what I owe"
                loading={loading}
              />
            </SummaryStrip>
          )
        }
      />
      {debts.data === undefined ? (
        debts.isError ? (
          <ErrorState onRetry={() => void debts.refetch()} />
        ) : (
          <ItemCardSkeletons count={2} />
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
        groups.map((group) =>
          group.items.length ? (
            <ListSection
              key={group.title}
              id={`debts-${group.items[0]?.direction}`}
              variant="heading"
              align="edge"
              title={group.title}
              total={
                <Amount
                  minor={
                    group.items[0]?.direction === "owed_to_me"
                      ? totals.owedToMeMinor
                      : -totals.iOweMinor
                  }
                  currency={currency}
                  signed
                  animate={false}
                />
              }
            >
              <CardGrid label={group.title}>
                {group.items.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    repaying={repaying === debt.id}
                    onRepay={(on) => setRepaying(on ? debt.id : null)}
                  />
                ))}
              </CardGrid>
            </ListSection>
          ) : null,
        )
      )}
      <SettledDebts debts={settled} />
    </div>
  );
}
