import { parseLocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle";
import { formatAmount } from "@/lib/format";
import { useAccounts } from "@/lib/queries";
import { useUserTime } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { AmountField } from "./amount-field";
import { readPositiveAmount } from "./amount-text";
import { DebtForecast, DebtRepay } from "./debt-actions";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { type Debt, useDebts } from "./queries";

type Direction = "owed_to_me" | "i_owe";

export function DebtPanel({ id, onClose }: PanelComponentProps) {
  const { data: debts } = useDebts();
  const debt = id === "new" ? undefined : debts?.find((d) => d.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !debt)
    return (
      <Panel open onClose={onClose} title="Loan">
        <PanelSkeleton fields={4} />
      </Panel>
    );
  return <DebtForm debt={debt} onClose={onClose} />;
}

/**
 * A new personal loan, optionally logging the money leaving or arriving now. An
 * existing loan edits only who, the note, the reminder and whether it's settled:
 * the direction, amount and opening account are fixed once created.
 */
function DebtForm({ debt, onClose }: { debt: Debt | undefined; onClose: () => void }) {
  const { timeZone } = useUserTime();
  const { data: accounts = [] } = useAccounts();
  const reminder = debt?.remindAt ?? debt?.dueAt ?? null;
  const initial = {
    direction: (debt?.direction ?? "owed_to_me") as Direction,
    person: debt?.person ?? "",
    amount: "",
    note: debt?.note ?? "",
    accountId: null as string | null,
    remind: reminder === null ? null : toLocalDate(reminder, timeZone),
    closed: Boolean(debt?.closedAt),
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof initial>) => setForm((f) => ({ ...f, ...patch }));
  const principalMinor = readPositiveAmount(form.amount);
  const valid = Boolean(form.person.trim() && (debt || principalMinor));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    if (!valid) return;
    const remindAt = form.remind
      ? zonedTimeToUtc({ ...parseLocalDate(form.remind), hour: 10 }, timeZone)
      : null;
    setSaving(true);
    try {
      if (debt)
        await write({
          method: "PATCH",
          path: `/debts/${debt.id}`,
          body: {
            person: form.person.trim(),
            note: form.note || null,
            remindAt,
            dueAt: remindAt,
            // Re-sending "closed" would restamp when it was settled.
            ...(form.closed === Boolean(debt.closedAt) ? {} : { closed: form.closed }),
          },
          label: "Couldn't save",
        });
      else
        await write({
          method: "POST",
          path: "/debts",
          body: {
            id: newId(),
            person: form.person.trim(),
            direction: form.direction,
            principalMinor,
            note: form.note || null,
            accountId: form.accountId,
            remindAt,
            dueAt: remindAt,
          },
          label: "Couldn't save",
        });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={debt ? debt.person : "New loan"}
      dirty={dirty}
      footer={
        <>
          {debt ? (
            <DeleteButton
              onClick={() => {
                onClose();
                void remove(`/debts/${debt.id}`, `“${debt.person}”`).catch(() => {});
              }}
            />
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!valid}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {debt && !debt.closedAt ? (
          <section
            aria-label="Repayment"
            className="flex flex-col gap-3 rounded-2xl bg-background p-4"
          >
            <h3 className="text-body font-bold">Log a repayment</h3>
            <DebtRepay debt={debt} secondary />
            <DebtForecast debt={debt} label="Payoff forecast" />
          </section>
        ) : null}
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {debt ? (
            <p className="text-caption text-muted">
              {debt.direction === "owed_to_me" ? "Lent" : "Borrowed"}{" "}
              {formatAmount(debt.principalMinor, { currency: debt.currency })}
            </p>
          ) : (
            <Segmented<Direction>
              label="Who owes"
              value={form.direction}
              onChange={(direction) => set({ direction })}
              options={[
                { value: "owed_to_me", label: "I lent" },
                { value: "i_owe", label: "I borrowed" },
              ]}
              className="self-start"
            />
          )}
          <TextField
            label="Person"
            value={form.person}
            onChange={(e) => set({ person: e.target.value })}
            placeholder="Name"
            autoFocus={!debt}
          />
          {debt ? null : (
            <AmountField
              label="Amount"
              value={form.amount}
              onChange={(amount) => set({ amount })}
            />
          )}
          <TextField
            label="Note"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="For the bike repair"
          />
          {debt ? null : (
            <Select
              label={
                form.direction === "owed_to_me"
                  ? "Paid from (optional)"
                  : "Received into (optional)"
              }
              value={form.accountId ?? NONE}
              options={[
                { value: NONE, label: "Don't log money" },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={(v) => set({ accountId: v === NONE ? null : v })}
            />
          )}
          <DateField
            label="Remind me"
            value={form.remind}
            clearable
            hint={form.remind ? undefined : "No reminder"}
            onChange={(remind) => set({ remind })}
          />
          {debt ? (
            <div className="overflow-hidden rounded-2xl border border-line">
              <ToggleRow
                label="Settled"
                checked={form.closed}
                onChange={(closed) => set({ closed })}
              />
            </div>
          ) : null}
          <button type="submit" hidden />
        </form>
      </div>
    </Panel>
  );
}
