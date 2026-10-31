import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { useEffect, useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { usePrivacy } from "@/lib/prefs";
import { useSettings } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { useThisMonth } from "@/lib/use-today";
import { fire, write } from "@/lib/write";
import { AmountField } from "./amount-field";
import { amountText } from "./amount-text";
import { type Amounts, budgetLines, jarMoves, leftToAssign, minorOf, prefill } from "./payday-math";
import { useBudgets, useGoals } from "./queries";

function AmountRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-body">{label}</span>
      <AmountField
        value={value}
        onChange={onChange}
        placeholder="0"
        aria-label={label}
        className="w-36"
      />
    </div>
  );
}

/**
 * Payday plan ("Split my pay" in Budgets): split the salary across rent, bills, family,
 * jars and flexible spending until ৳0 is left. `amount` (minor units) pre-fills what
 * landed, when it comes from a Received income.
 */
export function PaydayPlan({ amount }: { amount?: number }) {
  const navigate = useNavigate();
  const open = useOpenPanel();
  const hidden = usePrivacy();
  const month = useThisMonth();
  const budgets = useBudgets(month);
  const goals = useGoals();
  const { data: settings } = useSettings();
  const [salary, setSalary] = useState(amount ? amountText(amount) : "");
  const [amounts, setAmounts] = useState<Amounts>({});
  const [saving, setSaving] = useState(false);
  const lines = (budgets.data?.lines ?? []).filter((l) => l.parentId === null);
  const jars = (goals.data ?? []).filter((g) => !g.reached);

  useEffect(() => {
    if (!budgets.data) return;
    setAmounts((current) => prefill(current, budgets.data.lines, goals.data ?? []));
  }, [budgets.data, goals.data]);

  const salaryMinor = minorOf(salary);
  const left = leftToAssign(salary, amounts);
  const set = (key: string) => (text: string) => setAmounts((a) => ({ ...a, [key]: text }));

  const save = async () => {
    setSaving(true);
    try {
      await write({
        method: "PUT",
        path: "/budgets",
        body: { month, budgets: budgetLines(lines, amounts) },
        label: "Couldn't save the plan",
      });
    } catch {
      setSaving(false);
      return;
    }
    for (const move of jarMoves(jars, amounts, settings?.defaultAccountId))
      fire({
        method: "POST",
        path: `/goals/${move.goalId}/contribute`,
        body: { id: newId(), amountMinor: move.amountMinor, fromAccountId: move.fromAccountId },
        label: `Couldn't fill ${move.name}`,
      });
    notify("Every taka has a job.");
    void navigate({ to: "/money/budgets" });
  };

  const group = (title: string, type: string) => {
    const rows = lines.filter((l) => l.budgetType === type);
    if (rows.length === 0) return null;
    return (
      <Section title={title}>
        <Group>
          {rows.map((l) => (
            <AmountRow
              key={l.categoryId}
              label={`${l.emoji} ${l.name}`}
              value={amounts[l.categoryId] ?? ""}
              onChange={set(l.categoryId)}
            />
          ))}
        </Group>
      </Section>
    );
  };

  const saveLabel =
    left === 0 || salaryMinor === 0
      ? "Save plan"
      : hidden
        ? "Save with some unassigned"
        : left < 0
          ? `Save with ${formatAmount(-left)} over`
          : `Save with ${formatAmount(left)} unassigned`;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Payday plan"
        subtitle="Give every taka a job"
        back={{ to: "/money/budgets", label: "Budgets" }}
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <AmountField
            label="Salary that landed"
            value={salary}
            onChange={setSalary}
            placeholder="45000"
            autoFocus
          />
          <div className="flex flex-col gap-1 rounded-3xl bg-card p-6">
            {salaryMinor === 0 ? (
              <>
                {/* No salary yet: what's already planned, without a scary minus. */}
                <p className="text-callout text-muted">Planned so far</p>
                <Amount minor={-left} className="block truncate text-hero" />
                <p className="text-callout text-muted">Type the salary to see what's left.</p>
              </>
            ) : (
              <>
                <p className="text-callout text-muted">Left to assign</p>
                <Amount
                  minor={left}
                  tone={left < 0 ? "out" : left === 0 ? "in" : undefined}
                  className="block truncate text-hero"
                />
                {left === 0 ? (
                  <p className="text-callout text-muted">Every taka has a job.</p>
                ) : left < 0 ? (
                  <p className="text-callout text-muted">
                    A little more than the salary is planned. Trim a line or two.
                  </p>
                ) : null}
              </>
            )}
          </div>
          <Button
            variant="primary"
            size="lg"
            block
            disabled={salaryMinor === 0}
            loading={saving}
            onClick={() => void save()}
          >
            {saveLabel}
          </Button>
        </div>
        <div className="flex flex-col gap-7">
          {!budgets.data ? (
            budgets.isError ? (
              <ErrorState onRetry={() => void budgets.refetch()} />
            ) : (
              <div role="status" aria-label="Loading">
                <SkeletonRows rows={5} />
              </div>
            )
          ) : lines.length === 0 ? (
            <EmptyState
              title="No categories yet"
              message="Add a few spending categories to split your salary across them."
              actionLabel="Add categories"
              onAction={() => open("category:new")}
            />
          ) : (
            <>
              {group("Fixed", "fixed")}
              {group("Non-monthly set-asides", "non_monthly")}
              {jars.length ? (
                <Section title="Savings jars">
                  <Group>
                    {jars.map((g) => (
                      <AmountRow
                        key={g.id}
                        label={`${g.emoji} ${g.name}`}
                        value={amounts[`goal:${g.id}`] ?? ""}
                        onChange={set(`goal:${g.id}`)}
                      />
                    ))}
                  </Group>
                </Section>
              ) : null}
              {group("Flexible", "flexible")}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
