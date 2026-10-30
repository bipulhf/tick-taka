import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/confetti";
import { Select } from "@/components/ui/select";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useAccounts } from "@/lib/queries";
import { scheduleRefresh } from "@/lib/query-client";
import { notify, notifyError } from "@/lib/toast";
import { AmountField } from "./amount-field";
import { readPositiveAmount } from "./amount-text";
import { contributionSource } from "./goal-money";
import type { Goal } from "./queries";

/** "Add money": an amount and the account it leaves, moved into the jar. */
export function GoalContribute({
  goal,
  onDone,
  autoFocus,
  secondary,
}: {
  goal: Goal;
  onDone?: () => void;
  autoFocus?: boolean;
  /** Inside a panel whose Save is the primary action. */
  secondary?: boolean;
}) {
  const { data: accounts = [] } = useAccounts();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sources = accounts.filter((a) => a.id !== goal.accountId);
  const fromAccountId = contributionSource(goal.accountId, from, accounts);
  const amountMinor = readPositiveAmount(amount);

  const contribute = async () => {
    if (!amountMinor || !fromAccountId) return;
    setBusy(true);
    try {
      const result = await unwrap(
        api.goals[":id"].contribute.$post({
          param: { id: goal.id },
          json: { id: newId(), amountMinor, fromAccountId },
        }),
      );
      if (result.justReached) {
        celebrate();
        notify(`${result.goal.emoji} ${result.goal.name} reached!`);
      } else notify("Added to the jar");
      setAmount("");
      scheduleRefresh("/goals");
      onDone?.();
    } catch (error) {
      notifyError(friendlyError(error, "save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="@container">
      <form
        className="flex flex-col gap-3 @lg:flex-row @lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void contribute();
        }}
      >
        <AmountField
          label="Amount"
          value={amount}
          onChange={setAmount}
          autoFocus={autoFocus}
          className="@lg:w-36"
        />
        <Select
          label="From account"
          value={fromAccountId ?? null}
          options={sources.map((a) => ({ value: a.id, label: a.name }))}
          onChange={setFrom}
          className="@lg:flex-1"
        />
        <Button
          type="submit"
          variant={secondary ? "secondary" : "primary"}
          loading={busy}
          disabled={!amountMinor || !fromAccountId}
        >
          Move to jar
        </Button>
      </form>
    </div>
  );
}
