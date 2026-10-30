import { useQueryClient } from "@tanstack/react-query";
import { costInHours } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { useAccounts, useHourlyRate, useSettings } from "@/lib/queries";
import { playSound } from "@/lib/sounds";
import { notify } from "@/lib/toast";
import { useUserTime } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { amountText } from "./amount-text";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { applyNewExpense } from "./optimistic-expense";
import { type Account, type Transaction, useTransaction } from "./queries";
import { TransactionFields } from "./transaction-fields";
import {
  type Draft,
  draftFromPreset,
  draftFromTransaction,
  type Form,
  fieldErrors,
  formFromDraft,
  formSchema,
  transactionBody,
} from "./transaction-form";

/**
 * "transaction:<id>" edits one; "transaction:new" logs one, starting from `preset`
 * (type, amountMinor, note, categoryId, accountId, toAccountId, occurredAt, receiptPath).
 */
export function TransactionPanel({ id, preset, onClose }: PanelComponentProps) {
  const isNew = id === "new";
  const existing = useTransaction(isNew ? null : id);
  const accounts = useAccounts();
  const settings = useSettings();
  const ready = accounts.data && settings.data && (isNew || existing.data);
  if (!ready)
    return (
      <Panel open onClose={onClose} title="Transaction">
        {existing.isError ? (
          <ErrorState onRetry={() => void existing.refetch()} />
        ) : (
          <PanelSkeleton fields={5} />
        )}
      </Panel>
    );
  return (
    <TransactionForm
      existing={isNew ? undefined : existing.data}
      accounts={accounts.data ?? []}
      defaultAccountId={settings.data?.defaultAccountId ?? null}
      preset={preset}
      onClose={onClose}
    />
  );
}

function TransactionForm({
  existing,
  accounts,
  defaultAccountId,
  preset,
  onClose,
}: {
  existing: Transaction | undefined;
  accounts: Account[];
  defaultAccountId: string | null;
  preset: URLSearchParams;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const { data: settings } = useSettings();
  const hourly = useHourlyRate();
  const { timeZone } = useUserTime();
  const currencyOf = (accountId: string | null) =>
    accounts.find((a) => a.id === accountId)?.currency ?? "BDT";
  const [initial] = useState<Draft>(() =>
    existing
      ? draftFromTransaction(existing, currencyOf)
      : draftFromPreset(
          preset,
          { accountId: defaultAccountId ?? accounts[0]?.id ?? "", now: Date.now() },
          currencyOf,
        ),
  );
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const dropTarget = useRef<((file: File) => void) | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const account = accounts.find((a) => a.id === draft.accountId);
  const toAccount = accounts.find((a) => a.id === draft.toAccountId);
  const crossCurrency = Boolean(
    draft.type === "transfer" && account && toAccount && account.currency !== toAccount.currency,
  );
  const currencies = { from: account?.currency ?? "BDT", to: toAccount?.currency ?? "BDT" };
  const form = formFromDraft(draft, currencies, existing?.amountMinor);
  const hours =
    draft.type === "expense" &&
    settings?.costInHours &&
    form.amountMinor >= settings.costInHoursThresholdMinor
      ? costInHours(form.amountMinor, hourly.data?.rateMinor ?? null)
      : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const save = async () => {
    const checked = formSchema.safeParse(form);
    if (!checked.success) {
      setErrors(fieldErrors(checked.error));
      return;
    }
    setErrors({});
    const body = transactionBody(checked.data, {
      crossCurrency,
      adjustmentMinor: existing?.amountMinor,
    });
    setSaving(true);
    try {
      if (existing) {
        await write({
          method: "PATCH",
          path: `/transactions/${existing.id}`,
          body,
          label: "Couldn't save",
        });
        if (body.categoryId !== existing.categoryId && body.note)
          notify("Got it. Next time this goes to the same category.");
      } else {
        applyNewExpense(client, body);
        await write({
          method: "POST",
          path: "/transactions",
          body: { id: newId(), ...body },
          label: "Couldn't save",
        });
        playSound("pop");
      }
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const onFile = (event: React.DragEvent | React.ClipboardEvent) => {
    const files = "dataTransfer" in event ? event.dataTransfer.files : event.clipboardData.files;
    const file = files[0];
    if (!file || !dropTarget.current) return;
    event.preventDefault();
    dropTarget.current(file);
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={existing ? "Transaction" : "New transaction"}
      dirty={dirty && !saving}
      footer={
        <>
          {existing ? (
            <DeleteButton
              onClick={() => {
                void remove(`/transactions/${existing.id}`, "the transaction")
                  .then(onClose)
                  .catch(() => {});
              }}
            />
          ) : null}
          <Button variant="primary" className="flex-1" loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onFile}
        onPaste={onFile}
      >
        <TransactionFields
          draft={draft}
          set={set}
          errors={errors}
          accounts={accounts}
          timeZone={timeZone}
          isNew={!existing}
          hours={hours}
          dropTarget={dropTarget}
          onReceiptRead={(read) =>
            set({
              ...(read.amountMinor
                ? { amount: amountText(read.amountMinor, currencies.from) }
                : {}),
              ...(read.categoryId ? { categoryId: read.categoryId } : {}),
              ...(read.note ? { note: read.note } : {}),
              occurredAt: read.occurredAt,
            })
          }
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Panel>
  );
}
