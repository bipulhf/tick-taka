import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { useCategories } from "@/lib/queries";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import type { BudgetType } from "./budget-lines";
import { EmojiGrid } from "./emoji-grid";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import type { Category } from "./queries";

export const BUCKET_LABEL: Record<BudgetType, string> = {
  flexible: "Flexible",
  fixed: "Fixed",
  non_monthly: "Non-monthly",
};
const BUCKETS: { value: BudgetType; label: string; hint: string }[] = [
  { value: "flexible", label: "Flexible", hint: "Changes month to month, like food or fun" },
  { value: "fixed", label: "Fixed", hint: "The same every month, like rent or internet" },
  { value: "non_monthly", label: "Non-monthly", hint: "Now and then, like gifts or repairs" },
];
const EMOJIS = ["🍽️", "🛒", "🚌", "🏠", "💡", "📱", "💊", "🎓", "👕", "🎁", "🐾", "🎮"];

/** "category:<id>" or "category:new": add a spending category, or rename and regroup one. */
export function CategoryPanel({ id, onClose }: PanelComponentProps) {
  const categories = useCategories();
  const category = id === "new" ? undefined : categories.data?.find((c) => c.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !category)
    return (
      <Panel open onClose={onClose} title="Category">
        {categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : (
          <PanelSkeleton fields={3} />
        )}
      </Panel>
    );
  return <CategoryForm category={category} onClose={onClose} />;
}

function CategoryForm({
  category,
  onClose,
}: {
  category: Category | undefined;
  onClose: () => void;
}) {
  const { data: all = [] } = useCategories();
  const parents = all.filter(
    (c) => c.kind === "expense" && c.parentId === null && c.id !== category?.id,
  );
  const hasChildren = !!category && all.some((c) => c.parentId === category.id);
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "🏷️");
  const [budgetType, setBudgetType] = useState<BudgetType>(category?.budgetType ?? "flexible");
  const [parentId, setParentId] = useState<string | null>(category?.parentId ?? null);
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== (category?.name ?? "") ||
    emoji !== (category?.emoji ?? "🏷️") ||
    budgetType !== (category?.budgetType ?? "flexible") ||
    parentId !== (category?.parentId ?? null);

  const save = async () => {
    if (!name.trim() || !emoji.trim()) return;
    const body = { name: name.trim(), emoji: emoji.trim(), budgetType, parentId };
    setSaving(true);
    try {
      await write(
        category
          ? { method: "PATCH", path: `/categories/${category.id}`, body, label: "Couldn't save" }
          : {
              method: "POST",
              path: "/categories",
              body: { id: newId(), ...body, kind: "expense" },
              label: "Couldn't add the category",
            },
      );
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={category ? category.name : "New category"}
      dirty={dirty && !saving}
      footer={
        <>
          {category ? (
            <DeleteButton
              onClick={() => {
                void remove(`/categories/${category.id}`, `“${category.name}”`).catch(() => {});
                onClose();
              }}
            />
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!name.trim() || !emoji.trim()}
            onClick={() => void save()}
          >
            {category ? "Save" : "Add category"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
          <TextField
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            aria-label="Emoji"
            className="text-center"
          />
          <TextField
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pets, Gym, Bazar…"
            aria-label="Category name"
            autoFocus={!category}
          />
        </div>
        <EmojiGrid label="Emoji" value={emoji.trim()} options={EMOJIS} onChange={setEmoji} />
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Budget bucket</span>
          <Segmented<BudgetType>
            label="Budget bucket"
            value={budgetType}
            onChange={setBudgetType}
            options={BUCKETS.map((b) => ({ value: b.value, label: b.label }))}
            className="self-start"
          />
          <p className="text-caption font-normal text-muted">
            {BUCKETS.find((b) => b.value === budgetType)?.hint}
          </p>
        </div>
        {hasChildren ? null : (
          <Select
            label="Sits under"
            value={parentId ?? NONE}
            options={[
              { value: NONE, label: "Nothing (top level)" },
              ...parents.map((p) => ({ value: p.id, label: p.name, leading: p.emoji })),
            ]}
            onChange={(value) => setParentId(value === NONE ? null : value)}
          />
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Panel>
  );
}
