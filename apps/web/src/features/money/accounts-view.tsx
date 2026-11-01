import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useOpenPanel } from "@/lib/panel";
import { useAccounts } from "@/lib/queries";
import { AccountRows } from "./account-rows";

/** Balances that match the real world, wallet included. */
export function AccountsView() {
  const accounts = useAccounts();
  const open = useOpenPanel();
  const add = () => open("account:new");
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Accounts"
        actions={
          <Button variant="primary" icon={Plus} onClick={add}>
            New
          </Button>
        }
      />
      {accounts.data === undefined ? (
        accounts.isError ? (
          <ErrorState onRetry={() => void accounts.refetch()} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : accounts.data.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          message="Add where your money lives: cash, bKash, bank, cards."
          actionLabel="Add an account"
          onAction={add}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <AccountRows accounts={accounts.data} opens="panel" showCurrency />
          <p className="px-1 text-caption font-normal text-muted">
            Open an account to check its balance against the real one. Its menu archives or deletes
            it.
          </p>
        </div>
      )}
    </div>
  );
}
