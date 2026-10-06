import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { PickerField } from "@/components/ui/picker-field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { useCategories } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";

type Category = NonNullable<ReturnType<typeof useCategories>["data"]>[number];
type BudgetType = Category["budgetType"];

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

/** Add a spending category, or rename one, change its emoji, parent or budget bucket. */
export function CategorySheet({ id }: { id: string | null }) {
  const categories = useCategories();
  const category = id ? categories.data?.find((c) => c.id === id) : undefined;
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !category)
    return (
      <Sheet title="Category">
        {categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : (
          <SkeletonForm fields={3} />
        )}
      </Sheet>
    );
  return <CategoryForm category={category} />;
}

function CategoryForm({ category }: { category: Category | undefined }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const { data: all = [] } = useCategories();
  const parents = all.filter(
    (c) => c.kind === "expense" && c.parentId === null && c.id !== category?.id,
  );
  const hasChildren = !!category && all.some((c) => c.parentId === category.id);
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "🏷️");
  const [budgetType, setBudgetType] = useState<BudgetType>(category?.budgetType ?? "flexible");
  const [parentId, setParentId] = useState<string | null>(category?.parentId ?? null);
  const save = () => {
    if (!name.trim() || !emoji.trim()) return;
    const body = { name: name.trim(), emoji: emoji.trim(), budgetType, parentId };
    if (category)
      send({
        method: "PATCH",
        path: `/categories/${category.id}`,
        body: { ...body, updatedAt: editTime() },
        label: "Couldn't save",
      });
    else
      send({
        method: "POST",
        path: "/categories",
        body: { id: newId(), ...body, kind: "expense" },
        label: "Couldn't add the category",
      });
    router.back();
  };
  return (
    <Sheet
      title={category ? category.name : "New category"}
      footer={
        <View className="flex-row gap-2">
          {category ? (
            <DeleteButton
              onPress={() => {
                remove(`/categories/${category.id}`, `“${category.name}”`);
                router.back();
              }}
            />
          ) : null}
          <Button
            label={category ? "Save" : "Add category"}
            onPress={save}
            disabled={!name.trim() || !emoji.trim()}
            className="flex-1"
          />
        </View>
      }
    >
      <View className="flex-row gap-2">
        <TextField
          value={emoji}
          onChangeText={setEmoji}
          accessibilityLabel="Emoji"
          className="w-16"
        />
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Pets, Gym, Bazar…"
          accessibilityLabel="Category name"
          autoFocus={!category}
          className="flex-1"
        />
      </View>
      <PickerField
        label="Emoji"
        layout="grid"
        value={emoji.trim() || null}
        options={EMOJIS.map((e) => ({ id: e, label: e }))}
        onChange={(e) => setEmoji(e ?? emoji)}
      />
      <Text variant="label" tone="muted">
        Budget bucket
      </Text>
      <Segmented<BudgetType>
        label="Budget bucket"
        value={budgetType}
        onChange={setBudgetType}
        options={BUCKETS.map((b) => ({ value: b.value, label: b.label }))}
      />
      <Text variant="caption" tone="muted">
        {BUCKETS.find((b) => b.value === budgetType)?.hint}
      </Text>
      {hasChildren ? null : (
        <PickerField
          label="Sits under"
          value={parentId}
          noneLabel="Nothing (top level)"
          options={parents.map((p) => ({ id: p.id, label: p.name, emoji: p.emoji }))}
          onChange={setParentId}
        />
      )}
    </Sheet>
  );
}
