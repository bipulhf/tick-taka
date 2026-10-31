import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { monthOf } from "@tick-taka/shared/dates";
import { toBanglaDigits } from "@tick-taka/shared/digits";
import { firstBudgetCategory, withFirstBudget } from "@tick-taka/shared/first-budget";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAmount, numeralsStore } from "@/lib/format";
import { type TodayData, useCategories, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { updateToday } from "@/lib/today-cache";
import { write } from "@/lib/write";
import { AmountField } from "../money/amount-field";
import { readPositiveAmount } from "../money/amount-text";

/**
 * The safe-to-spend card before any flexible budget exists: one question and one
 * amount. Saving sets this month's first budget (see shared/first-budget.ts) and
 * the card turns into today's number straight away.
 */
export function FirstBudget({ data }: { data: TodayData }) {
  const client = useQueryClient();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const bangla = useStore(numeralsStore) === "beng";
  const fieldId = useId();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const currency = settings?.defaultCurrency ?? "BDT";
  const limitMinor = readPositiveAmount(text, currency);
  const categoryId = categories ? firstBudgetCategory(categories) : null;
  const month = monthOf(data.date);

  const save = async () => {
    if (!limitMinor || !categoryId || saving) return;
    setSaving(true);
    try {
      await write({
        method: "PUT",
        path: `/budgets/${month}/${categoryId}`,
        body: { limitMinor },
        label: "Couldn't save the budget",
      });
      // Show the number now; the refresh that follows brings the server's own.
      updateToday(client, (today) =>
        monthOf(today.date) === month
          ? { ...today, safeToSpend: withFirstBudget(today.safeToSpend, limitMinor, today.date) }
          : today,
      );
    } catch {
      // The toast says why; the amount stays to try again.
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-callout text-muted">Safe to spend today</p>
      <label htmlFor={fieldId} className="text-body font-bold">
        Spending money this month
      </label>
      <div className="flex items-start gap-2">
        <AmountField
          id={fieldId}
          value={text}
          onChange={setText}
          currency={currency}
          placeholder={bangla ? toBanglaDigits("0") : "0"}
          hint="Day-to-day spending, not rent or bills."
          className="min-w-0 flex-1"
        />
        <Button type="submit" loading={saving} disabled={!limitMinor || !categoryId}>
          {limitMinor ? `Save ${formatAmount(limitMinor, { currency })}` : "Save"}
        </Button>
      </div>
      <Link
        to="/money/budgets"
        className="-mx-1.5 self-start rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
      >
        Set budgets by category
      </Link>
    </form>
  );
}
