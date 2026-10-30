import { addDays } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Panel } from "@/components/ui/panel";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle";
import { useAccounts } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { useTodayDate } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { AmountField } from "./amount-field";
import { amountText, readPositiveAmount } from "./amount-text";
import { EmojiGrid } from "./emoji-grid";
import { GoalContribute } from "./goal-contribute";
import { isFutureDeadline } from "./goal-money";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { type Goal, useGoals } from "./queries";

const EMOJIS = ["🫙", "💻", "🏍️", "✈️", "🏠", "🎓", "💍", "🕋", "🚑"];

/** Create or edit a savings goal; an open goal can take money here too. */
export function GoalPanel({ id, onClose }: PanelComponentProps) {
  const { data: goals } = useGoals();
  const goal = id === "new" ? undefined : goals?.find((g) => g.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !goal)
    return (
      <Panel open onClose={onClose} title="Goal">
        <PanelSkeleton fields={5} />
      </Panel>
    );
  return <GoalForm goal={goal} onClose={onClose} />;
}

function GoalForm({ goal, onClose }: { goal: Goal | undefined; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const today = useTodayDate();
  const initial = {
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? "🫙",
    target: amountText(goal?.targetMinor),
    deadline: goal?.deadline ?? null,
    accountId: goal?.accountId ?? null,
    createTasks: goal?.createTasks ?? true,
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof initial>) => setForm((f) => ({ ...f, ...patch }));
  const targetMinor = readPositiveAmount(form.target);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const valid = Boolean(form.name.trim() && targetMinor);

  const save = async () => {
    if (!valid || !targetMinor) return;
    const body = {
      name: form.name.trim(),
      emoji: form.emoji,
      targetMinor,
      deadline: form.deadline,
      accountId: form.accountId,
      createTasks: form.createTasks,
    };
    setSaving(true);
    try {
      if (goal)
        await write({ method: "PATCH", path: `/goals/${goal.id}`, body, label: "Couldn't save" });
      else
        await write({
          method: "POST",
          path: "/goals",
          body: { id: newId(), ...body },
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
      title={goal ? goal.name : "New savings goal"}
      dirty={dirty}
      footer={
        <>
          {goal ? (
            <DeleteButton
              onClick={() => {
                onClose();
                void remove(`/goals/${goal.id}`, `“${goal.name}”`).catch(() => {});
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
        {goal && !goal.reached ? (
          <section
            aria-label="Add money"
            className="flex flex-col gap-2 rounded-2xl bg-background p-4"
          >
            <h3 className="text-body font-bold">Add money</h3>
            <GoalContribute goal={goal} secondary />
          </section>
        ) : null}
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="New laptop"
            autoFocus={!goal}
          />
          <EmojiGrid
            label="Emoji"
            value={form.emoji}
            options={EMOJIS}
            onChange={(emoji) => set({ emoji })}
          />
          <AmountField
            label="Target"
            value={form.target}
            onChange={(target) => set({ target })}
            placeholder="120000"
          />
          <DateField
            label="Deadline"
            value={form.deadline}
            min={addDays(today, 1)}
            clearable
            hint={form.deadline ? undefined : "No deadline"}
            onChange={(deadline) => {
              if (deadline && !isFutureDeadline(deadline, today))
                return notify("Pick a day after today for the deadline");
              set({ deadline });
            }}
          />
          <Select
            label="Jar account (optional)"
            value={form.accountId ?? NONE}
            options={[
              { value: NONE, label: "Virtual jar" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            onChange={(v) => set({ accountId: v === NONE ? null : v })}
          />
          <div className="overflow-hidden rounded-2xl border border-line">
            <ToggleRow
              label="Add a monthly “move money to the jar” task"
              checked={form.createTasks}
              onChange={(createTasks) => set({ createTasks })}
            />
          </div>
          <button type="submit" hidden />
        </form>
      </div>
    </Panel>
  );
}
