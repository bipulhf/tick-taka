import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";
import { notify } from "@/lib/toast";
import { write } from "@/lib/write";
import { AmountField } from "./amount-field";
import { readAmount } from "./amount-text";
import type { Account } from "./queries";

/** "App says ৳4,530. What does the real balance say?" Any gap is logged as an adjustment. */
export function BalanceCheck({ account }: { account: Account }) {
  const [actual, setActual] = useState("");
  const [busy, setBusy] = useState(false);
  const actualMinor = readAmount(actual, account.currency);

  const check = async () => {
    if (actualMinor === null) return;
    const gap = actualMinor - account.balanceMinor;
    setBusy(true);
    try {
      await write({
        method: "POST",
        path: `/accounts/${account.id}/balance-check`,
        body: { actualMinor, id: newId() },
        label: "Couldn't log the adjustment",
      });
      notify(
        gap === 0
          ? "Already matches. Honest numbers!"
          : `Logged an adjustment of ${formatAmount(gap, { currency: account.currency, signed: true })}`,
      );
      setActual("");
    } catch {
      // The toast says what went wrong; the typed balance stays.
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="balance-check"
      className="flex flex-col gap-2 rounded-2xl bg-line/35 p-4"
    >
      <h3 id="balance-check" className="text-body font-bold">
        Balance check
      </h3>
      <p className="text-callout text-muted">
        App says <Amount minor={account.balanceMinor} currency={account.currency} animate={false} />
        . What does the real balance say?
      </p>
      <div className="flex items-start gap-2">
        <AmountField
          aria-label="Real balance"
          placeholder="Real balance"
          value={actual}
          onChange={setActual}
          currency={account.currency}
          className="flex-1"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void check();
            }
          }}
        />
        <Button loading={busy} disabled={actualMinor === null} onClick={check}>
          Fix it
        </Button>
      </div>
    </section>
  );
}
