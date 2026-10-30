import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { Toggle } from "@/components/ui/toggle";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatAmount, formatMonth } from "@/lib/format";
import { useAiStatus } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { write } from "@/lib/write";
import { AmountField } from "./amount-field";
import { amountText } from "./amount-text";
import { BUCKETS, type EditorLine, editorLines, editorPayload, editorTotal } from "./budget-lines";
import { PanelSkeleton } from "./money-ui";
import { useBudgets } from "./queries";

/**
 * A month's limits per category, for the Budgets view's edit mode and the "budget"
 * panel. Sub-categories keep their limits: they are sent back as they were.
 */
export function useBudgetEditor(month: string, suggested?: Record<string, number>) {
  const budgets = useBudgets(month);
  const [lines, setLines] = useState<Record<string, EditorLine>>({});
  const [start, setStart] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!budgets.data) return;
    const next = editorLines(budgets.data.lines, suggested);
    setLines(next);
    setStart(JSON.stringify(next));
  }, [budgets.data, suggested]);
  const setLine = (categoryId: string, patch: Partial<EditorLine>) =>
    setLines((all) => ({
      ...all,
      [categoryId]: { limit: "", rollover: false, ...all[categoryId], ...patch },
    }));
  const fill = (limits: Record<string, number>) =>
    setLines((all) => {
      const next = { ...all };
      for (const [categoryId, limitMinor] of Object.entries(limits))
        next[categoryId] = {
          rollover: all[categoryId]?.rollover ?? false,
          limit: amountText(limitMinor),
        };
      return next;
    });
  /** Resolves true once saved; a failure keeps what was typed (the toast says why). */
  const save = async (): Promise<boolean> => {
    // Saving before the budgets load would replace them with an empty set.
    if (!budgets.data) return false;
    setSaving(true);
    try {
      await write({
        method: "PUT",
        path: "/budgets",
        body: { month, budgets: editorPayload(lines) },
        label: "Couldn't save budgets",
      });
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };
  return {
    budgets,
    lines,
    setLine,
    fill,
    save,
    saving,
    ready: Boolean(budgets.data),
    dirty: start !== "" && JSON.stringify(lines) !== start,
    total: editorTotal(lines),
  };
}

export type BudgetEditorState = ReturnType<typeof useBudgetEditor>;

/** The editor's Save, with the month's total on it, as on the phone. */
export function BudgetSaveButton({
  editor,
  onSaved,
}: {
  editor: BudgetEditorState;
  onSaved: () => void;
}) {
  return (
    <Button
      variant="primary"
      className="flex-1"
      disabled={!editor.ready}
      loading={editor.saving}
      onClick={async () => {
        if (await editor.save()) onSaved();
      }}
    >
      Save {formatAmount(editor.total)}
    </Button>
  );
}

/** "Ask AI for suggestions", only when AI is set up and the feature is on. */
function AiSuggestions({
  month,
  onSuggested,
}: {
  month: string;
  onSuggested: (l: Record<string, number>) => void;
}) {
  const ai = useAiStatus();
  const suggest = useMutation({
    mutationFn: () => unwrap(api.ai["budget-suggestions"].$post({ json: { month } })),
    onSuccess: (result) => {
      onSuggested(Object.fromEntries(result.budgets.map((b) => [b.categoryId, b.limitMinor])));
      notify("Filled in AI suggestions. Check them before saving.");
    },
    onError: (error) => notify(friendlyError(error)),
  });
  if (!ai.data?.configured || !ai.data.features.budgetSuggestions) return null;
  return (
    <Button
      size="sm"
      icon={Sparkles}
      loading={suggest.isPending}
      onClick={() => suggest.mutate()}
      className="self-start"
    >
      Ask AI for suggestions
    </Button>
  );
}

/** One amount field and a rollover switch per top-level category, by bucket. */
export function BudgetEditorFields({
  editor,
  month,
}: {
  editor: BudgetEditorState;
  month: string;
}) {
  const parents = useMemo(
    () => (editor.budgets.data?.lines ?? []).filter((l) => l.parentId === null),
    [editor.budgets.data],
  );
  if (!editor.budgets.data) return <PanelSkeleton fields={6} />;
  return (
    <div className="flex flex-col gap-5">
      {editor.budgets.data.inherited ? (
        <p className="px-1 text-callout text-muted">
          Showing last month's limits. Save to keep them for {formatMonth(month)}.
        </p>
      ) : null}
      <AiSuggestions month={month} onSuggested={editor.fill} />
      {BUCKETS.map((bucket) => {
        const lines = parents.filter((l) => l.budgetType === bucket.key);
        if (lines.length === 0) return null;
        return (
          <section key={bucket.key} className="flex flex-col gap-2">
            <h3 className="px-1 text-caption text-muted">{bucket.title}</h3>
            <Group className="border border-line">
              {lines.map((line) => {
                const value = editor.lines[line.categoryId];
                return (
                  <div key={line.categoryId} className="flex items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">
                      <span aria-hidden>{line.emoji}</span> {line.name}
                    </span>
                    <AmountField
                      value={value?.limit ?? ""}
                      onChange={(limit) => editor.setLine(line.categoryId, { limit })}
                      placeholder="0"
                      aria-label={`${line.name} limit`}
                      className="w-28 sm:w-36"
                    />
                    <Toggle
                      checked={value?.rollover ?? false}
                      onChange={(rollover) => editor.setLine(line.categoryId, { rollover })}
                      label={`Roll over unspent ${line.name}`}
                    />
                  </div>
                );
              })}
            </Group>
          </section>
        );
      })}
      <p className="px-1 text-caption font-normal text-muted">
        The switch rolls unspent money into next month.
      </p>
    </div>
  );
}
