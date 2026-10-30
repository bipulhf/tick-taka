import { Link } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import type { AccountType } from "@tick-taka/shared/schemas/money";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { useAccounts, useSettings } from "@/lib/queries";
import { write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { AmountField } from "./amount-field";
import { amountText, readAmount } from "./amount-text";
import { BalanceCheck } from "./balance-check";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import type { Account } from "./queries";
import { useAccountActions } from "./use-account-actions";

export const ACCOUNT_TYPES: { value: AccountType; label: string; leading: string }[] = [
  { value: "cash", label: "Cash", leading: "💵" },
  { value: "bank", label: "Bank", leading: "🏦" },
  { value: "mobile_wallet", label: "Wallet", leading: "📱" },
  { value: "card", label: "Card", leading: "💳" },
  { value: "savings", label: "Savings", leading: "🫙" },
];
const CURRENCIES = ["BDT", "USD", "EUR", "GBP"];

/** "account:<id>" or "account:new": the account, its opening balance and a balance check. */
export function AccountPanel({ id, onClose }: PanelComponentProps) {
  const { data: accounts } = useAccounts();
  const account = id === "new" ? undefined : accounts?.find((a) => a.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !account)
    return (
      <Panel open onClose={onClose} title="Account">
        <PanelSkeleton fields={4} />
      </Panel>
    );
  return <AccountForm account={account} onClose={onClose} />;
}

function AccountForm({ account, onClose }: { account: Account | undefined; onClose: () => void }) {
  const actions = useAccountActions();
  const { data: settings } = useSettings();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "cash");
  const [currency, setCurrency] = useState(account?.currency ?? "BDT");
  const initialOpening = account ? amountText(account.openingMinor, account.currency) : "";
  const [opening, setOpening] = useState(initialOpening);
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== (account?.name ?? "") ||
    type !== (account?.type ?? "cash") ||
    opening !== initialOpening;

  const save = async () => {
    if (!name.trim()) return;
    const openingMinor = readAmount(opening || "0", currency) ?? 0;
    setSaving(true);
    try {
      if (account)
        await write({
          method: "PATCH",
          path: `/accounts/${account.id}`,
          body: { name: name.trim(), type, openingMinor },
          label: "Couldn't save",
        });
      else {
        const newAccountId = newId();
        await write({
          method: "POST",
          path: "/accounts",
          body: { id: newAccountId, name: name.trim(), type, currency, openingMinor },
          label: "Couldn't add the account",
        });
        if (!settings?.defaultAccountId)
          await write({
            method: "PATCH",
            path: "/settings",
            body: {
              defaultAccountId: newAccountId,
              ...(type === "cash" ? { cashAccountId: newAccountId } : {}),
            },
          });
      }
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={account ? account.name : "New account"}
      dirty={dirty && !saving}
      footer={
        <>
          {account ? (
            <>
              <DeleteButton
                onClick={async () => {
                  if (await actions.remove(account)) onClose();
                }}
              />
              <Button
                onClick={() => {
                  actions.archive(account);
                  onClose();
                }}
              >
                Archive
              </Button>
            </>
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!name.trim()}
            onClick={save}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {account ? <BalanceCheck account={account} /> : null}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="bKash"
          autoFocus={!account}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={type} options={ACCOUNT_TYPES} onChange={setType} />
          {!account ? (
            <Select
              label="Currency"
              value={currency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onChange={setCurrency}
            />
          ) : null}
        </div>
        <AmountField
          label="Opening balance"
          value={opening}
          onChange={setOpening}
          currency={currency}
          placeholder="0"
        />
        {account ? (
          <Link
            to="/money/transactions"
            search={{ accountId: account.id }}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-line-strong bg-card px-4 font-bold hover:bg-line/40"
          >
            <ArrowUpDown aria-hidden className="size-[18px]" />
            See transactions
          </Link>
        ) : null}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
      {actions.dialog}
    </Panel>
  );
}
