import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { formatMonth } from "@/lib/format";
import {
  BudgetEditorFields,
  BudgetSaveButton,
  RefineWithTiki,
  useBudgetEditor,
} from "./budget-editor";
import { PanelSkeleton } from "./money-ui";
import { useBudgetSuggestion } from "./queries";

/**
 * "Plan next month": the month's editor, started from the average of the last three
 * months, with an optional "Refine with Tiki". Nothing is saved until Save.
 */
export function BudgetPlan({ month, onDone }: { month: string; onDone: () => void }) {
  const suggestion = useBudgetSuggestion(month);
  // One object per answer, so the editor isn't refilled on every render.
  const suggested = useMemo(
    () =>
      suggestion.data
        ? Object.fromEntries(suggestion.data.budgets.map((b) => [b.categoryId, b.limitMinor]))
        : undefined,
    [suggestion.data],
  );
  const editor = useBudgetEditor(month, suggested);
  const caption =
    suggestion.data && suggestion.data.budgets.length === 0
      ? "Nothing to suggest yet. A few months of spending gives this a starting point."
      : "Started from the average of the last three months. Change anything you like.";
  return (
    <Section title={`Plan ${formatMonth(month)}`} caption={caption}>
      <RefineWithTiki month={month} onSuggested={editor.fill} />
      {suggestion.isPending ? (
        <PanelSkeleton fields={6} />
      ) : (
        <BudgetEditorFields editor={editor} month={month} planning />
      )}
      <div className="sticky bottom-24 z-10 flex gap-2 rounded-2xl border border-line bg-card p-2 shadow-lg shadow-ink/5 sm:bottom-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <BudgetSaveButton editor={editor} onSaved={onDone} />
      </div>
    </Section>
  );
}
