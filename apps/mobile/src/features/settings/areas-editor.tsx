import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAreas, useCategories } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";

const BUCKETS = ["flexible", "fixed", "non_monthly"] as const;
const BUCKET_LABEL = { flexible: "Flexible", fixed: "Fixed", non_monthly: "Non-monthly" } as const;

/** Areas as a list (tap to edit, swipe to delete); add categories, pick their bucket, tap one to edit it. */
export function AreasEditor() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const areasQuery = useAreas();
  const categoriesQuery = useCategories();
  const areas = areasQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const [newCategory, setNewCategory] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const parents = categories.filter((c) => c.parentId === null && c.kind === "expense");
  const categoryActions = (category: (typeof categories)[number]) =>
    editDelete(
      () => router.push(`/category/${category.id}`),
      () => remove(`/categories/${category.id}`, `“${category.name}”`),
    );

  return (
    <Screen title="Areas & categories" tabBarPadding={false}>
      <Section title="Areas">
        <AsyncContent
          query={areasQuery}
          skeleton={<SkeletonList rows={3} />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState title="No areas yet" message="Add one below, like Work, Home or Health." />
          }
        >
          {() => (
            <Group inset={60}>
              {areas.map((area) => (
                <SwipeRow
                  key={area.id}
                  rounded={false}
                  actions={editDelete(
                    () => router.push(`/area/${area.id}`),
                    () => remove(`/areas/${area.id}`, `“${area.name}”`),
                  )}
                >
                  <View className="bg-card">
                    <ListRow
                      emoji={area.emoji}
                      title={area.name}
                      right={
                        <View
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: area.color }}
                        />
                      }
                      chevron
                      onPress={() => router.push(`/area/${area.id}`)}
                    />
                  </View>
                </SwipeRow>
              ))}
            </Group>
          )}
        </AsyncContent>
        <Button
          label="New area"
          icon="plus"
          variant="secondary"
          onPress={() => router.push("/area/new")}
        />
        <Text variant="caption" tone="muted" className="px-1">
          Tap an area to rename or recolour it. Swipe left to delete.
        </Text>
      </Section>
      <Section title="Expense categories">
        <AsyncContent
          query={categoriesQuery}
          skeleton={<SkeletonList rows={4} leading="none" trailing />}
          isEmpty={() => parents.length === 0}
          empty={
            <EmptyState
              title="No categories yet"
              message="Add one below to start sorting your spending."
            />
          }
        >
          {() => (
            <Card className="gap-2">
              {parents.map((category) => (
                <View key={category.id} className="gap-1">
                  <SwipeRow actions={categoryActions(category)}>
                    <Pressable
                      onPress={() => router.push(`/category/${category.id}`)}
                      accessibilityRole="button"
                      accessibilityHint="Opens the category. Swipe left for edit and delete"
                      className="min-h-12 flex-row items-center justify-between gap-2 bg-card"
                    >
                      <Text className="flex-1">
                        {category.emoji} {category.name}
                      </Text>
                      <Chip
                        label={BUCKET_LABEL[category.budgetType]}
                        onPress={() =>
                          send({
                            method: "PATCH",
                            path: `/categories/${category.id}`,
                            body: {
                              budgetType:
                                BUCKETS[
                                  (BUCKETS.indexOf(category.budgetType) + 1) % BUCKETS.length
                                ],
                            },
                          })
                        }
                      />
                    </Pressable>
                  </SwipeRow>
                  {categories
                    .filter((c) => c.parentId === category.id)
                    .map((child) => (
                      <SwipeRow key={child.id} actions={categoryActions(child)}>
                        <Pressable
                          onPress={() => router.push(`/category/${child.id}`)}
                          accessibilityRole="button"
                          className="min-h-11 justify-center bg-card"
                        >
                          <Text variant="caption" tone="muted" className="pl-6">
                            › {child.emoji} {child.name}
                          </Text>
                        </Pressable>
                      </SwipeRow>
                    ))}
                </View>
              ))}
            </Card>
          )}
        </AsyncContent>
        <TextField
          value={newCategory}
          onChangeText={setNewCategory}
          placeholder="New category, e.g. Pets"
        />
        <View className="flex-row flex-wrap gap-2">
          <Chip label="Top level" selected={!parentId} onPress={() => setParentId(null)} />
          {parents.map((p) => (
            <Chip
              key={p.id}
              label={`under ${p.name}`}
              selected={parentId === p.id}
              onPress={() => setParentId(p.id)}
            />
          ))}
        </View>
        <Button
          label="Add category"
          variant="secondary"
          disabled={!newCategory.trim()}
          onPress={() => {
            send({
              method: "POST",
              path: "/categories",
              body: {
                id: newId(),
                name: newCategory.trim(),
                emoji: "🏷️",
                kind: "expense",
                parentId,
              },
              label: "Couldn't add the category",
            });
            notify(`Added ${newCategory.trim()}`);
            setNewCategory("");
          }}
        />
      </Section>
    </Screen>
  );
}
