import { describeRRule } from "@tick-taka/shared/recurrence";
import { DateField } from "@/components/ui/date-field";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { plural } from "@/lib/format";
import { useAccounts, useCategories } from "@/lib/queries";
import { AmountField } from "./amount-field";

export type Kind = "bill" | "income";

export interface RecurringDraft {
  kind: Kind;
  name: string;
  amount: string;
  currency: string;
  accountId: string | null;
  categoryId: string | null;
  repeat: string;
  dueDate: string;
  remindDays: number;
}

const CURRENCIES = ["BDT", "USD", "EUR"];
const REMIND_DAYS = [0, 1, 2, 3, 7];
const remindLabel = (days: number) => (days === 0 ? "On the day" : `${plural(days, "day")} before`);

/** The bill or income's own fields; the panel around them pays, saves and deletes. */
export function RecurringFields({
  draft,
  set,
  rrule,
  parsedRRule,
  amountError,
}: {
  draft: RecurringDraft;
  set: (patch: Partial<RecurringDraft>) => void;
  /** What it repeats on now: the typed words, else the saved rule. */
  rrule: string;
  /** The rule the typed words make, or null when they don't read as one. */
  parsedRRule: string | null;
  amountError?: string | null;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  return (
    <div className="flex flex-col gap-4">
      <Segmented<Kind>
        label="Kind"
        value={draft.kind}
        onChange={(kind) => set({ kind, categoryId: null })}
        options={[
          { value: "bill", label: "Bill" },
          { value: "income", label: "Income" },
        ]}
        className="self-start"
      />
      <TextField
        label="Name"
        value={draft.name}
        onChange={(event) => set({ name: event.target.value })}
        placeholder={draft.kind === "bill" ? "Internet" : "Job 1 salary"}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <AmountField
          label="Amount"
          value={draft.amount}
          onChange={(amount) => set({ amount })}
          currency={draft.currency}
          error={amountError}
        />
        <Select
          label="Currency"
          value={draft.currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onChange={(currency) => set({ currency })}
        />
      </div>
      <TextField
        label="Repeats"
        value={draft.repeat}
        onChange={(event) => set({ repeat: event.target.value })}
        placeholder={describeRRule(rrule)}
        error={draft.repeat.trim() && !parsedRRule ? "Try “every month on the 5th”" : undefined}
        hint={parsedRRule ? `↻ ${describeRRule(parsedRRule)}` : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Next due"
          value={draft.dueDate}
          onChange={(dueDate) => dueDate && set({ dueDate })}
        />
        <Select
          label="Remind me"
          value={String(draft.remindDays)}
          options={REMIND_DAYS.map((d) => ({ value: String(d), label: remindLabel(d) }))}
          onChange={(d) => set({ remindDays: Number(d) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Account"
          value={draft.accountId}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(accountId) => set({ accountId })}
        />
        <Select
          label="Category"
          value={draft.categoryId ?? NONE}
          options={[
            { value: NONE, label: "No category" },
            ...categories
              .filter((c) => c.kind === (draft.kind === "bill" ? "expense" : "income"))
              .map((c) => ({ value: c.id, label: c.name, leading: c.emoji })),
          ]}
          onChange={(id) => set({ categoryId: id === NONE ? null : id })}
        />
      </div>
    </div>
  );
}
