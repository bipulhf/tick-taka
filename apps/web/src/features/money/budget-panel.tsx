import { isLocalMonth } from "@tick-taka/shared/dates";
import { useMemo } from "react";
import { Panel } from "@/components/ui/panel";
import { formatMonth } from "@/lib/format";
import { useThisMonth } from "@/lib/use-today";
import type { PanelComponentProps } from "../panel-types";
import { BudgetEditorFields, BudgetSaveButton, useBudgetEditor } from "./budget-editor";
import { parseSuggested } from "./budget-lines";

/**
 * "budget:<YYYY-MM>": set a month's limits per category, from anywhere. A `suggested`
 * preset (a JSON object of categoryId → limitMinor) pre-fills it.
 */
export function BudgetPanel({ id, preset, onClose }: PanelComponentProps) {
  const thisMonth = useThisMonth();
  const month = isLocalMonth(id) ? id : thisMonth;
  const suggestedText = preset.get("suggested");
  // One object per preset, so the editor isn't refilled on every render.
  const suggested = useMemo(() => parseSuggested(suggestedText), [suggestedText]);
  const editor = useBudgetEditor(month, suggested);
  return (
    <Panel
      open
      onClose={onClose}
      title={`Budgets · ${formatMonth(month)}`}
      width="lg"
      dirty={editor.dirty}
      footer={<BudgetSaveButton editor={editor} onSaved={onClose} />}
    >
      <BudgetEditorFields editor={editor} month={month} />
    </Panel>
  );
}
