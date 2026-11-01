import { ArchiveRestore, ChevronRight, Scale } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ProgressBar } from "@/components/ui/progress";
import { useOpenPanel } from "@/lib/panel";
import { usePrivacy } from "@/lib/prefs";
import { notify } from "@/lib/toast";
import { fire } from "@/lib/write";
import { ACCOUNT_TYPES } from "./account-panel";
import { RowMenu } from "./money-ui";
import type { Account } from "./queries";
import type { useAccountActions } from "./use-account-actions";

const emojiFor = (account: Account) =>
  account.icon ?? ACCOUNT_TYPES.find((t) => t.value === account.type)?.leading ?? "💵";

/**
 * One account: its balance, a bar for its share of everything you have, and "Check
 * balance", which opens the account's panel (the balance check lives there).
 */
export function AccountRow({
  account,
  share,
  showCurrency,
  actions,
}: {
  account: Account;
  /** Share of the positive balances, 0 to 1; null for debt or another currency. */
  share: number | null;
  showCurrency: boolean;
  actions: ReturnType<typeof useAccountActions>;
}) {
  const open = useOpenPanel();
  const hidden = usePrivacy();
  const edit = () => open(`account:${account.id}`);
  // Hide amounts hides the share too: it would give the balances away.
  const percent = share === null || hidden ? null : Math.round(share * 100);
  return (
    <Row
      as="li"
      dataKey={`account:${account.id}`}
      keyActions={{ remove: () => void actions.remove(account) }}
      onClick={edit}
      leading={<RowMark emoji={emojiFor(account)} />}
      title={account.name}
      subtitle={
        <span className="flex items-center gap-2 pt-0.5">
          {percent !== null ? (
            <>
              <ProgressBar
                value={share ?? 0}
                tone="ink"
                label={`${account.name}, share of all your money`}
                className="h-1.5 w-24 shrink-0 sm:w-40 xl:w-64"
              />
              <span className="text-caption">{percent < 1 ? "under 1%" : `${percent}%`}</span>
            </>
          ) : account.balanceMinor < 0 ? (
            <span className="text-caption">Owed</span>
          ) : null}
          {showCurrency ? <span className="text-caption">{account.currency}</span> : null}
        </span>
      }
      trailing={
        <>
          <Button
            size="sm"
            variant="ghost"
            icon={Scale}
            onClick={edit}
            className="max-sm:hidden"
            aria-label={`Check balance: ${account.name}`}
          >
            Check balance
          </Button>
          <Amount
            minor={account.balanceMinor}
            currency={account.currency}
            animate={false}
            tone={account.balanceMinor < 0 ? "out" : undefined}
            className="min-w-24 text-right font-bold"
          />
          <RowMenu label={`More for ${account.name}`} items={actions.menuItems(account, edit)} />
        </>
      }
    />
  );
}

/** Archived accounts, folded away; each can come back with one click (and Undo). */
export function ArchivedAccounts({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) return null;
  const restore = (account: Account) => {
    fire({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: false } });
    notify(`Brought back ${account.name}`, {
      label: "Undo",
      onPress: () =>
        fire({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: true } }),
    });
  };
  return (
    <details className="group/archived flex flex-col">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 py-0.5 text-heading hover:bg-line/40 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted transition-transform duration-150 group-open/archived:rotate-90"
        />
        Archived
        <span className="text-callout font-normal text-muted">({accounts.length})</span>
      </summary>
      <p className="mt-1 mb-3 px-1 text-caption font-normal text-muted">
        Hidden from pickers and totals; their history stays.
      </p>
      <Group as="ul" label="Archived accounts">
        {accounts.map((account) => (
          <Row
            key={account.id}
            as="li"
            leading={<RowMark emoji={emojiFor(account)} />}
            title={account.name}
            trailing={
              <>
                <Amount
                  minor={account.balanceMinor}
                  currency={account.currency}
                  animate={false}
                  className="text-muted"
                />
                <Button
                  size="sm"
                  icon={ArchiveRestore}
                  onClick={() => restore(account)}
                  aria-label={`Unarchive ${account.name}`}
                >
                  Unarchive
                </Button>
              </>
            }
          />
        ))}
      </Group>
    </details>
  );
}
