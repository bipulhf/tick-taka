import { addMonths } from "@tick-taka/shared/dates";
import { Banknote, CalendarPlus, Pencil } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMonth } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useThisMonth, useToday, useTodayDate } from "@/lib/use-today";
import { fire, write } from "@/lib/write";
import { BudgetEditorFields, BudgetSaveButton, useBudgetEditor } from "./budget-editor";
import { BudgetLineRow } from "./budget-line-row";
import {
  BUCKETS,
  bucketLines,
  bucketShown,
  byCloseness,
  keptLines,
  noBudgets,
  paceMark,
  withoutLine,
} from "./budget-lines";
import { BudgetPlan } from "./budget-plan";
import { type Budgets, useBudgets } from "./queries";

/**
 * The month at a glance. This month: left to spend, today's daily allowance (as on
 * Today), spent so far and days left. Another month: left, spent and budgeted.
 */
function BudgetStrip({ data, month }: { data: Budgets; month: string }) {
  const thisMonth = useThisMonth();
  const today = useToday();
  const totals = BUCKETS.reduce(
    (sum, b) => ({
      limit: sum.limit + data.buckets[b.key].limitMinor,
      spent: sum.spent + data.buckets[b.key].spentMinor,
    }),
    { limit: 0, spent: 0 },
  );
  const left = totals.limit - totals.spent;
  const leftTile = (
    <StatTile
      label={left < 0 ? "Over by" : month < thisMonth ? "Left unspent" : "Left to spend"}
      tone={left < 0 ? "out" : "in"}
      minor={Math.abs(left)}
      caption={
        <>
          of <Amount minor={totals.limit} animate={false} /> budgeted
        </>
      }
    />
  );
  const spentTile = (
    <StatTile
      label={month === thisMonth ? "Spent so far" : "Spent"}
      tone="out"
      minor={totals.spent}
      caption={formatMonth(month)}
    />
  );
  if (month !== thisMonth)
    return (
      <SummaryStrip label={`Budgets, ${formatMonth(month)}`}>
        {leftTile}
        {spentTile}
        <StatTile label="Budgeted" minor={totals.limit} caption="All three groups" />
      </SummaryStrip>
    );
  const money = today.data?.safeToSpend;
  return (
    <SummaryStrip label={`Budgets, ${formatMonth(month)}`}>
      {leftTile}
      <StatTile
        label="Daily allowance"
        minor={money?.dailyMinor}
        caption="Flexible, for each day left"
        loading={!money}
      />
      {spentTile}
      <StatTile
        label="Days left"
        tone="time"
        value={money ? money.daysLeft : undefined}
        caption={`In ${formatMonth(month)}`}
        loading={!money}
      />
    </SummaryStrip>
  );
}

function Editor({ month, onDone }: { month: string; onDone: () => void }) {
  const editor = useBudgetEditor(month);
  return (
    <Section title={`Budgets · ${formatMonth(month)}`}>
      <BudgetEditorFields editor={editor} month={month} />
      <div className="sticky bottom-24 z-10 flex gap-2 rounded-2xl border border-line bg-card p-2 shadow-lg shadow-ink/5 sm:bottom-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <BudgetSaveButton editor={editor} onSaved={onDone} />
      </div>
    </Section>
  );
}

/**
 * Monthly limits in three buckets, with rollover and a calm pace heads-up. `plan` is
 * the month being planned ("Plan next month"), from the URL.
 */
export function BudgetsView({
  plan,
  onPlan,
  onSplit,
}: {
  plan?: string;
  onPlan: (month: string | undefined) => void;
  /** "Split my pay": the payday plan. */
  onSplit: () => void;
}) {
  const thisMonth = useThisMonth();
  const today = useTodayDate();
  const [viewMonth, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState(false);
  const month = plan ?? viewMonth;
  const budgets = useBudgets(month);
  const data = budgets.data;
  const edit = () => setEditing(true);

  /** The API sets a whole month at once, so dropping one line re-sends the others. */
  const removeLine = (line: { categoryId: string; name: string }) => {
    if (!data) return;
    const before = keptLines(data.lines);
    write({
      method: "PUT",
      path: "/budgets",
      body: { month, budgets: withoutLine(data.lines, line.categoryId) },
      label: "Couldn't delete",
    })
      .then(() =>
        notify(`Deleted the ${line.name} budget`, {
          label: "Undo",
          onPress: () =>
            fire({
              method: "PUT",
              path: "/budgets",
              body: { month, budgets: before },
              label: "Couldn't undo",
            }),
        }),
      )
      .catch(() => {});
  };

  const body = () => {
    if (!data)
      return budgets.isError ? (
        <ErrorState onRetry={() => void budgets.refetch()} />
      ) : (
        <div className="flex flex-col gap-7">
          <SkeletonRows rows={4} />
          <SkeletonRows rows={2} />
        </div>
      );
    if (plan)
      return (
        <BudgetPlan
          month={plan}
          onDone={() => {
            setMonth(plan);
            onPlan(undefined);
          }}
        />
      );
    if (editing) return <Editor month={month} onDone={() => setEditing(false)} />;
    if (noBudgets(data.lines))
      return (
        <EmptyState
          title="No budgets yet"
          message="Give a few categories a monthly limit so you can spend without second-guessing."
          actionLabel="Set budgets"
          onAction={edit}
        />
      );
    const pace = paceMark(today, month);
    const section = (bucket: (typeof BUCKETS)[number]) => {
      const totals = data.buckets[bucket.key];
      const lines = byCloseness(bucketLines(data.lines, bucket.key));
      if (!bucketShown(totals, lines) || lines.length === 0) return null;
      return (
        <ListSection
          key={bucket.key}
          id={`budget-${bucket.key}`}
          variant="heading"
          title={bucket.title}
          caption={bucket.hint}
          total={
            <span className="text-muted">
              <Amount minor={totals.spentMinor} animate={false} className="text-ink" /> of{" "}
              <Amount minor={totals.limitMinor} animate={false} />
            </span>
          }
        >
          <Group>
            {lines.map((line) => (
              <BudgetLineRow
                key={line.categoryId}
                line={line}
                pace={pace}
                onEdit={edit}
                onRemove={() => removeLine(line)}
              />
            ))}
          </Group>
        </ListSection>
      );
    };
    // Flexible (usually the longest) on the left; Fixed and Non-monthly beside it.
    const [flexible, ...others] = BUCKETS.map(section);
    const right = others.filter(Boolean);
    return (
      <div
        className={cx(
          "grid grid-cols-[minmax(0,1fr)] items-start gap-7",
          flexible && right.length > 0 && "xl:grid-cols-2",
        )}
      >
        {flexible}
        {right.length ? <div className="flex min-w-0 flex-col gap-7">{right}</div> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Budgets"
        subtitle={
          data?.inherited && !plan
            ? `Showing last month's limits. Save to keep them for ${formatMonth(month)}.`
            : undefined
        }
        actions={
          <>
            <MonthStepper
              month={month}
              onChange={(next) => {
                setMonth(next);
                setEditing(false);
                if (plan) onPlan(undefined);
              }}
            />
            {editing || plan ? null : (
              <>
                <Button icon={CalendarPlus} onClick={() => onPlan(addMonths(thisMonth, 1))}>
                  Plan next month
                </Button>
                <Button icon={Banknote} onClick={onSplit}>
                  Split my pay
                </Button>
              </>
            )}
          </>
        }
        primary={
          editing || plan
            ? undefined
            : { label: "Edit budgets", icon: Pencil, onClick: edit, disabled: !data }
        }
        summary={
          data && !plan && !editing && !noBudgets(data.lines) ? (
            <BudgetStrip data={data} month={month} />
          ) : undefined
        }
      />
      {body()}
    </div>
  );
}
