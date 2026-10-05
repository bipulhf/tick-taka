import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
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

const BUCKETS: { value: BudgetType; label: string }[] = [
  { value: "flexible", label: "Flexible" },
  { value: "fixed", label: "Fixed" },
  { value: "non_monthly", label: "Non-monthly" },
];

/** Rename a category, change its emoji or budget bucket. */
export function CategorySheet({ id }: { id: string }) {
  const categories = useCategories();
  const category = categories.data?.find((c) => c.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (!category)
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

function CategoryForm({ category }: { category: Category }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [budgetType, setBudgetType] = useState<BudgetType>(category.budgetType);
  const save = () => {
    if (!name.trim() || !emoji.trim()) return;
    send({
      method: "PATCH",
      path: `/categories/${category.id}`,
      body: { name: name.trim(), emoji: emoji.trim(), budgetType, updatedAt: editTime() },
      label: "Couldn't save",
    });
    router.back();
  };
  return (
    <Sheet
      title={category.name}
      footer={
        <View className="flex-row gap-2">
          <DeleteButton
            onPress={() => {
              remove(`/categories/${category.id}`, `“${category.name}”`);
              router.back();
            }}
          />
          <Button
            label="Save"
            onPress={save}
            disabled={!name.trim() || !emoji.trim()}
            className="flex-1"
          />
        </View>
      }
    >
      <View className="flex-row gap-2">
        <TextField value={emoji} onChangeText={setEmoji} className="w-16" />
        <TextField value={name} onChangeText={setName} placeholder="Name" className="flex-1" />
      </View>
      <Text variant="label" tone="muted">
        Budget bucket
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <Chip
            key={b.value}
            label={b.label}
            selected={budgetType === b.value}
            onPress={() => setBudgetType(b.value)}
          />
        ))}
      </View>
    </Sheet>
  );
}
