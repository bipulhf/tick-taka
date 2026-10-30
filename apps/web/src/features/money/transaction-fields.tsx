import { DateField, joinInstant, splitInstant, TimeField } from "@/components/ui/date-field";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { plural } from "@/lib/format";
import { useAreas, useCategories } from "@/lib/queries";
import { AmountField } from "./amount-field";
import type { Account } from "./queries";
import { useEvents } from "./queries";
import { categoryOptions } from "./transaction-filters";
import type { Draft, Form, TxType } from "./transaction-form";
import { type ReceiptRead, TransactionReceipt } from "./transaction-receipt";

const none = (value: string | null) => value ?? NONE;
const some = (value: string) => (value === NONE ? null : value);

/** Every field of the transaction panel, in the phone sheet's order. */
export function TransactionFields({
  draft,
  set,
  errors,
  accounts,
  timeZone,
  isNew,
  hours,
  onReceiptRead,
  dropTarget,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Partial<Record<keyof Form, string>>;
  accounts: Account[];
  timeZone: string;
  isNew: boolean;
  /** "≈ 3 hours of work" for a big expense, when Settings asks for it. */
  hours: number | null;
  onReceiptRead: (read: ReceiptRead) => void;
  dropTarget: { current: ((file: File) => void) | null };
}) {
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const { data: events = [] } = useEvents();
  const account = accounts.find((a) => a.id === draft.accountId);
  const toAccount = accounts.find((a) => a.id === draft.toAccountId);
  const transfer = draft.type === "transfer";
  const crossCurrency = transfer && account && toAccount && account.currency !== toAccount.currency;
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const when = splitInstant(draft.occurredAt, timeZone);

  return (
    <div className="flex flex-col gap-4">
      {draft.type !== "adjustment" ? (
        <Segmented<TxType>
          label="Type"
          value={draft.type}
          onChange={(type) => set({ type })}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
          className="w-full"
        />
      ) : (
        <p className="text-callout text-muted">Balance check adjustment</p>
      )}
      <AmountField
        label="Amount"
        autoFocus={isNew}
        value={draft.amount}
        currency={account?.currency}
        disabled={draft.type === "adjustment"}
        onChange={(amount) => set({ amount })}
        error={errors.amountMinor}
        hint={hours ? `≈ ${plural(hours, "hour")} of work` : "Sums work too, like 1850/3"}
        placeholder="0"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={transfer ? "From" : "Account"}
          value={draft.accountId || null}
          options={accountOptions}
          onChange={(accountId) => set({ accountId })}
          error={errors.accountId}
        />
        {transfer ? (
          <Select
            label="To"
            value={draft.toAccountId}
            placeholder="Pick one"
            options={accountOptions.filter((a) => a.value !== draft.accountId)}
            onChange={(toAccountId) => set({ toAccountId })}
            error={errors.toAccountId}
          />
        ) : draft.type !== "adjustment" ? (
          <Select
            label="Category"
            value={none(draft.categoryId)}
            options={[
              { value: NONE, label: "No category" },
              ...categoryOptions(categories, draft.type === "income" ? "income" : "expense"),
            ]}
            onChange={(id) => set({ categoryId: some(id) })}
          />
        ) : null}
      </div>
      {transfer ? (
        <div className="grid grid-cols-2 gap-3">
          {crossCurrency ? (
            <AmountField
              label={`Arrived in ${toAccount.currency}`}
              currency={toAccount.currency}
              value={draft.toAmount}
              onChange={(toAmount) => set({ toAmount })}
            />
          ) : null}
          <AmountField
            label="Fee (e.g. cash-out charge)"
            currency={account?.currency}
            value={draft.fee}
            onChange={(fee) => set({ fee })}
            className={crossCurrency ? undefined : "col-span-2"}
          />
        </div>
      ) : null}
      <TextField
        label="Note"
        value={draft.note}
        onChange={(event) => set({ note: event.target.value })}
        placeholder="Merchant or person"
        maxLength={2000}
      />
      <div className="flex items-end gap-3">
        <DateField
          label="When"
          value={when.date}
          onChange={(date) => date && set({ occurredAt: joinInstant(date, when.time, timeZone) })}
          className="flex-1"
        />
        <TimeField
          label="Time"
          value={when.time}
          onChange={(time) => time && set({ occurredAt: joinInstant(when.date, time, timeZone) })}
          className="w-32"
        />
        <button
          type="button"
          onClick={() => set({ occurredAt: Date.now() })}
          className="h-10 rounded-xl px-3 text-callout font-bold text-sky-text hover:bg-sky/10"
        >
          Now
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Area"
          value={none(draft.areaId)}
          options={[
            { value: NONE, label: "No area" },
            ...areas.map((a) => ({ value: a.id, label: a.name, leading: a.emoji })),
          ]}
          onChange={(id) => set({ areaId: some(id) })}
        />
        {events.length > 0 ? (
          <Select
            label="Event"
            value={none(draft.eventId)}
            options={[
              { value: NONE, label: "No event" },
              ...events.map((e) => ({ value: e.id, label: e.name, leading: e.emoji })),
            ]}
            onChange={(id) => set({ eventId: some(id) })}
          />
        ) : null}
      </div>
      <TransactionReceipt
        isNew={isNew}
        path={draft.receiptPath}
        onPath={(receiptPath) => set({ receiptPath })}
        onRead={onReceiptRead}
        dropTarget={dropTarget}
      />
    </div>
  );
}
