import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatAmount, plural } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { useAccounts, useCategories } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { write } from "@/lib/write";
import { AmountField } from "./amount-field";
import { readPositiveAmount } from "./amount-text";

/** Ticked items become one expense: the estimate, or what was really paid. */
export function ShoppingCheckout({
  listName,
  checkedCount,
  checkedMinor,
}: {
  listName: string;
  checkedCount: number;
  checkedMinor: number;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [paid, setPaid] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hidden = usePrivacy();
  const account = accountId ?? accounts[0]?.id ?? null;
  const groceries = categories.find((c) => c.name === "Groceries")?.id ?? null;

  const checkout = async () => {
    if (!account) return notify("Add an account first");
    const amountMinor = paid ? readPositiveAmount(paid) : null;
    setBusy(true);
    try {
      await write({
        method: "POST",
        path: "/shopping/checkout",
        body: {
          transactionId: newId(),
          listName,
          accountId: account,
          categoryId: groceries,
          ...(amountMinor ? { amountMinor } : {}),
        },
        label: "Couldn't check out",
      });
      notify(`Logged ${formatAmount(amountMinor ?? checkedMinor)} for ${listName}`);
      setPaid("");
    } catch {
      // The toast says what went wrong; the ticks and the typed amount stay.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Checkout"
      className="flex flex-col gap-4 rounded-2xl bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void checkout();
      }}
    >
      <h2 className="text-heading">
        Checkout · {plural(checkedCount, "item")} · est.{" "}
        <Amount minor={checkedMinor} animate={false} />
      </h2>
      <AmountField
        label="Paid"
        value={paid}
        onChange={setPaid}
        placeholder={hidden ? "Paid" : `Paid (default ${formatAmount(checkedMinor)})`}
      />
      <Select
        label="Paid from"
        value={account}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={setAccountId}
      />
      <Button type="submit" variant="primary" loading={busy}>
        Log as one expense
      </Button>
    </form>
  );
}
