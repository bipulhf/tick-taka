import { Plus } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts, useSettings } from "@/lib/queries";
import { AccountRow, ArchivedAccounts } from "./account-group-rows";
import { cardsOwed, groupAccounts, shareOfTotal, totalIn } from "./account-groups";
import { useAccountsWithArchived } from "./queries";
import { useAccountActions } from "./use-account-actions";

/**
 * Balances that match the real world, wallet included: net worth and where it sits,
 * then the accounts by type with each group's total, each with a share bar and Check
 * balance. Archived accounts stay folded away at the end.
 */
export function AccountsView() {
  const accounts = useAccounts();
  const all = useAccountsWithArchived();
  const { data: settings } = useSettings();
  const actions = useAccountActions();
  const open = useOpenPanel();
  const add = () => open("account:new");
  const currency = settings?.defaultCurrency ?? "BDT";
  const list = accounts.data ?? [];
  const groups = groupAccounts(list, currency);
  const total = (key: string) => groups.find((g) => g.key === key)?.totalMinor ?? 0;
  const owed = cardsOwed(list, currency);
  const archived = (all.data ?? []).filter((a) => a.archivedAt !== null);
  const loading = !accounts.data;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Accounts"
        primary={{ label: "New account", icon: Plus, onClick: add }}
        summary={
          accounts.data?.length === 0 ? undefined : (
            <SummaryStrip label="Where your money is" layout="lead">
              <StatTile
                size="lead"
                label="Net worth"
                minor={totalIn(list, currency)}
                currency={currency}
                caption="All accounts"
                loading={loading}
              />
              <StatTile
                label="Cash and wallets"
                minor={total("cash")}
                currency={currency}
                caption="Cash and mobile wallets"
                loading={loading}
              />
              <StatTile
                label="Bank and savings"
                minor={total("bank")}
                currency={currency}
                caption="Bank accounts and savings"
                loading={loading}
              />
              <StatTile
                label="Cards owed"
                tone={owed > 0 ? "out" : "neutral"}
                minor={owed}
                currency={currency}
                caption="To pay back"
                loading={loading}
              />
            </SummaryStrip>
          )
        }
      />
      {accounts.data === undefined ? (
        accounts.isError ? (
          <ErrorState onRetry={() => void accounts.refetch()} />
        ) : (
          <div className="flex flex-col gap-7">
            <SkeletonRows rows={3} />
            <SkeletonRows rows={2} />
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          message="Add where your money lives: cash, bKash, bank, cards."
          actionLabel="Add an account"
          onAction={add}
        />
      ) : (
        groups.map((group) => (
          <ListSection
            key={group.key}
            id={`accounts-${group.key}`}
            variant="heading"
            title={group.title}
            total={<Amount minor={group.totalMinor} currency={currency} animate={false} />}
          >
            <Group as="ul" label={group.title}>
              {group.accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  share={shareOfTotal(account, list, currency)}
                  showCurrency={account.currency !== currency}
                  actions={actions}
                />
              ))}
            </Group>
          </ListSection>
        ))
      )}
      <ArchivedAccounts accounts={archived} />
      {actions.dialog}
    </div>
  );
}
