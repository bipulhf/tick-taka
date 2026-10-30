import { Pencil } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatMonth } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useThisMonth } from "@/lib/use-today";
import { fire, write } from "@/lib/write";
import { BudgetEditorFields, BudgetSaveButton, useBudgetEditor } from "./budget-editor";
import { BudgetLineRow } from "./budget-line-row";
import {
  BUCKETS,
  bucketLines,
  bucketShown,
  keptLines,
  noBudgets,
  withoutLine,
} from "./budget-lines";
import { type Budgets, useBudgets } from "./queries";

/** The three buckets' totals for the month, beside the lines on a wide screen. */
function BucketSummary({ data }: { data: Budgets }) {
  return (
    <Section title="This month">
      <Group>
        {BUCKETS.map((bucket) => {
          const totals = data.buckets[bucket.key];
          return (
            <div key={bucket.key} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-bold">{bucket.title}</span>
                <span className="text-callout text-muted">
                  <Amount minor={totals.spentMinor} className="font-bold text-ink" /> of{" "}
                  <Amount minor={totals.limitMinor} animate={false} />
                </span>
              </div>
              <ProgressBar
                value={totals.limitMinor ? totals.spentMinor / totals.limitMinor : 0}
                tone={totals.availableMinor < 0 ? "coral" : "mint"}
                label={`${bucket.title} spent of its budget`}
              />
              <p className="text-caption font-normal text-muted">{bucket.hint}</p>
            </div>
          );
        })}
      </Group>
    </Section>
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

/** Monthly limits in three buckets, with rollover and a calm pace heads-up. */
export function BudgetsView() {
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState(false);
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
    return (
      <div className="flex flex-col gap-7">
        {BUCKETS.map((bucket) => {
          const lines = bucketLines(data.lines, bucket.key);
          if (!bucketShown(data.buckets[bucket.key], lines) || lines.length === 0) return null;
          return (
            <Section key={bucket.key} title={bucket.title}>
              <Group>
                {lines.map((line) => (
                  <BudgetLineRow
                    key={line.categoryId}
                    line={line}
                    onEdit={edit}
                    onRemove={() => removeLine(line)}
                  />
                ))}
              </Group>
            </Section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Budgets"
        back={{ to: "/money", label: "Money" }}
        actions={
          <>
            <MonthStepper
              month={month}
              onChange={(next) => {
                setMonth(next);
                setEditing(false);
              }}
            />
            {editing ? null : (
              <Button icon={Pencil} onClick={edit} disabled={!data}>
                Edit budgets
              </Button>
            )}
          </>
        }
      />
      {data?.inherited ? (
        <p className="-mt-3 text-callout text-muted">
          Showing last month's limits. Save to keep them for {formatMonth(month)}.
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0">{body()}</div>
        {data && !noBudgets(data.lines) ? <BucketSummary data={data} /> : null}
      </div>
    </div>
  );
}
