import { useNavigate } from "@tanstack/react-router";
import { Amount } from "@/components/ui/amount";
import { Group, Row, RowMark } from "@/components/ui/group";
import { useOpenPanel } from "@/lib/panel";
import { ACCOUNT_TYPES } from "./account-panel";
import { RowMenu } from "./money-ui";
import type { Account } from "./queries";
import { useAccountActions } from "./use-account-actions";

const emojiFor = (account: Account) =>
  account.icon ?? ACCOUNT_TYPES.find((t) => t.value === account.type)?.leading ?? "💵";

/**
 * The accounts as one grouped list. `opens` decides what a click does: Accounts edits
 * the account (and its balance check), the overview shows its transactions.
 */
export function AccountRows({
  accounts,
  opens,
  showCurrency,
}: {
  accounts: Account[];
  opens: "panel" | "transactions";
  showCurrency?: boolean;
}) {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const actions = useAccountActions();
  return (
    <>
      <Group>
        {accounts.map((account) => {
          const edit = () => open(`account:${account.id}`);
          return (
            <Row
              key={account.id}
              dataKey={`account:${account.id}`}
              keyActions={{ remove: () => void actions.remove(account) }}
              leading={<RowMark emoji={emojiFor(account)} />}
              title={account.name}
              subtitle={showCurrency ? account.currency : undefined}
              onClick={
                opens === "panel"
                  ? edit
                  : () =>
                      void navigate({
                        to: "/money/transactions",
                        search: { accountId: account.id },
                      })
              }
              trailing={
                <>
                  <Amount
                    minor={account.balanceMinor}
                    currency={account.currency}
                    animate={false}
                    tone={account.balanceMinor < 0 ? "out" : undefined}
                    className="font-bold"
                  />
                  <RowMenu
                    label={`More for ${account.name}`}
                    items={actions.menuItems(account, edit)}
                  />
                </>
              }
            />
          );
        })}
      </Group>
      {actions.dialog}
    </>
  );
}
