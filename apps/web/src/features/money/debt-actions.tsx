import { useQuery } from "@tanstack/react-query";
import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api, unwrap } from "@/lib/api";
import { formatAmount, formatMonth, plural } from "@/lib/format";
import { useAccounts } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { write } from "@/lib/write";
import { AmountField } from "./amount-field";
import { readPositiveAmount } from "./amount-text";
import type { Debt } from "./queries";

/** "Monthly payment for a forecast": when a loan would be cleared at that pace. */
export function DebtForecast({ debt, label }: { debt: Debt; label?: string }) {
  const [monthly, setMonthly] = useState("");
  const monthlyMinor = readPositiveAmount(monthly, debt.currency) ?? 0;
  const forecast = useQuery({
    queryKey: ["debt-forecast", debt.id, monthlyMinor],
    queryFn: () =>
      unwrap(
        api.debts[":id"].forecast.$get({
          param: { id: debt.id },
          query: { monthly: String(monthlyMinor) },
        }),
      ),
    enabled: monthlyMinor > 0,
  });
  return (
    <div className="flex flex-col gap-1">
      <AmountField
        label={label}
        aria-label={label ? undefined : `Monthly payment for ${debt.person}'s forecast`}
        value={monthly}
        onChange={setMonthly}
        currency={debt.currency}
        placeholder="Monthly payment for a forecast"
      />
      {forecast.data && monthlyMinor > 0 ? (
        <p className="text-caption text-sky-text" aria-live="polite">
          Cleared in {formatMonth(forecast.data.clearedIn)} ·{" "}
          {plural(forecast.data.months, "payment")}
        </p>
      ) : null}
    </div>
  );
}

/** A partial repayment: the amount and the account it moves through. */
export function DebtRepay({
  debt,
  onDone,
  autoFocus,
  secondary,
}: {
  debt: Debt;
  onDone?: () => void;
  autoFocus?: boolean;
  /** Inside a panel whose Save is the primary action. */
  secondary?: boolean;
}) {
  const { data: accounts = [] } = useAccounts();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const account = accountId ?? accounts[0]?.id ?? null;
  const amountMinor = readPositiveAmount(amount, debt.currency);
  const repay = async () => {
    if (!amountMinor || !account) return;
    setBusy(true);
    try {
      await write({
        method: "POST",
        path: `/debts/${debt.id}/repay`,
        body: { id: newId(), amountMinor, accountId: account },
        label: "Couldn't log the repayment",
      });
      notify(
        `Logged ${formatAmount(amountMinor, { currency: debt.currency })} from ${debt.person}`,
      );
      setAmount("");
      onDone?.();
    } catch {
      // The toast already says what went wrong; what was typed stays.
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
          void repay();
        }}
      >
        <AmountField
          label="Amount repaid"
          value={amount}
          onChange={setAmount}
          currency={debt.currency}
          autoFocus={autoFocus}
          className="@lg:w-36"
        />
        <Select
          label="Account"
          value={account}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          onChange={setAccountId}
          className="@lg:flex-1"
        />
        <Button
          type="submit"
          variant={secondary ? "secondary" : "primary"}
          loading={busy}
          disabled={!amountMinor || !account}
        >
          Log repayment
        </Button>
      </form>
    </div>
  );
}
