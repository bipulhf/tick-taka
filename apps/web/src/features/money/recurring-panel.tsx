import { parseLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { toAsciiDigits } from "@tick-taka/shared/digits";
import { newId } from "@tick-taka/shared/ids";
import { parseRecurrence } from "@tick-taka/shared/recurrence";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { TextField } from "@/components/ui/text-field";
import { formatAmount, formatLocalDate } from "@/lib/format";
import { useAccounts, useSettings } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { amountText, readPositiveAmount } from "./amount-text";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { type Recurring, useRecurring } from "./queries";
import { type RecurringDraft, RecurringFields } from "./recurring-fields";
import { payRecurring } from "./recurring-pay";

/** "recurring:<id>" or "recurring:new": a bill or expected income; Paid / Received logs it. */
export function RecurringPanel({ id, onClose }: PanelComponentProps) {
  const recurring = useRecurring();
  const item = id === "new" ? undefined : recurring.data?.find((r) => r.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !item)
    return (
      <Panel open onClose={onClose} title="Bill">
        {recurring.data ? (
          <EmptyState
            title="Not here any more"
            message="That's no longer here. It may have been deleted."
            mood="calm"
          />
        ) : (
          <PanelSkeleton fields={6} />
        )}
      </Panel>
    );
  return <RecurringForm item={item} onClose={onClose} />;
}

function RecurringForm({ item, onClose }: { item: Recurring | undefined; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: settings } = useSettings();
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  // The form as it opened, to tell whether anything typed would be lost.
  const [initial] = useState<RecurringDraft>(() => ({
    kind: item?.kind ?? "bill",
    name: item?.name ?? "",
    amount: item ? amountText(item.amountMinor, item.currency) : "",
    currency: item?.currency ?? "BDT",
    accountId: item?.accountId ?? settings?.defaultAccountId ?? null,
    categoryId: item?.categoryId ?? null,
    repeat: "",
    dueDate: item?.dueDate ?? today,
    remindDays: item?.remindDays ?? 2,
  }));
  const [draft, setDraft] = useState(initial);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState<"save" | "pay" | "skip" | null>(null);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<RecurringDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const parsed = useMemo(
    () => (draft.repeat.trim() ? parseRecurrence(`x ${draft.repeat}`) : null),
    [draft.repeat],
  );
  const rrule = parsed?.rrule ?? item?.rrule ?? "FREQ=MONTHLY";
  // Settings may arrive after the panel opens: the default account fills in then.
  const accountId = draft.accountId ?? settings?.defaultAccountId ?? null;
  const account = accounts.find((a) => a.id === accountId);
  const foreign = Boolean(account && account.currency !== draft.currency);
  const amountMinor = readPositiveAmount(draft.amount, draft.currency);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || rate !== "";

  const save = async () => {
    setTried(true);
    if (!amountMinor || !draft.name.trim()) return;
    const body = {
      kind: draft.kind,
      name: draft.name.trim(),
      amountMinor,
      currency: draft.currency,
      accountId,
      categoryId: draft.categoryId,
      rrule,
      nextDueAt: zonedTimeToUtc({ ...parseLocalDate(draft.dueDate), hour: 9 }, timeZone),
      remindDays: draft.remindDays,
    };
    setBusy("save");
    try {
      await write(
        item
          ? { method: "PATCH", path: `/recurring/${item.id}`, body, label: "Couldn't save" }
          : {
              method: "POST",
              path: "/recurring",
              body: { id: newId(), ...body },
              label: "Couldn't save",
            },
      );
      onClose();
    } catch {
      setBusy(null);
    }
  };

  const pay = async (skip = false) => {
    if (!item) return;
    const extra: Record<string, unknown> = accountId ? { accountId } : {};
    if (foreign && !skip) {
      const value = Number(toAsciiDigits(rate.trim()));
      if (!(value > 0)) return notify(`Enter the ${draft.currency} → ${account?.currency} rate`);
      extra.rate = value;
    }
    setBusy(skip ? "skip" : "pay");
    try {
      await payRecurring({ id: item.id, name: item.name, dueAt: item.nextDueAt }, { skip, extra });
      onClose();
    } catch {
      setBusy(null);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={item ? item.name : "New bill or income"}
      dirty={dirty && busy === null}
      footer={
        <div className="flex w-full flex-col gap-2">
          {item ? (
            <div className="flex gap-2">
              <Button className="flex-1" loading={busy === "skip"} onClick={() => void pay(true)}>
                Skip
              </Button>
              <Button
                className="flex-1"
                variant="primary"
                loading={busy === "pay"}
                onClick={() => void pay()}
              >
                {item.kind === "bill" ? "Paid" : "Received"}
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            {item ? (
              <DeleteButton
                onClick={() => {
                  void remove(`/recurring/${item.id}`, `“${item.name}”`).catch(() => {});
                  onClose();
                }}
              />
            ) : null}
            <Button
              className="flex-1"
              variant={item ? "secondary" : "primary"}
              loading={busy === "save"}
              disabled={!draft.name.trim() || !draft.amount}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {item ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-background p-4">
            <p className="text-body">
              Next due {formatLocalDate(item.dueDate, "long")} ·{" "}
              <span className="tabular">
                {formatAmount(item.amountMinor, { currency: item.currency })}
              </span>
            </p>
            {foreign ? (
              <TextField
                label={`Rate: ${account?.currency} per 1 ${draft.currency}`}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                inputMode="decimal"
                placeholder="121.50"
                autoFocus
              />
            ) : null}
          </div>
        ) : null}
        <RecurringFields
          draft={{ ...draft, accountId }}
          set={set}
          rrule={rrule}
          parsedRRule={parsed?.rrule ?? null}
          amountError={tried && draft.amount && !amountMinor ? "Enter an amount" : null}
        />
      </div>
    </Panel>
  );
}
