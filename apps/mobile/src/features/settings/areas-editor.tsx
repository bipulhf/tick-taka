import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { useAreas, useCategories } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";
import { BUCKET_LABEL } from "./category-sheet";

type Tab = "areas" | "categories";

/**
 * Areas and spending categories as two plain lists. Tap a row to change it, swipe
 * left to delete it, and add new ones with the button under each list.
 */
export function AreasEditor() {
  const router = useRouter();
  const remove = useRemove();
  const areasQuery = useAreas();
  const categoriesQuery = useCategories();
  const [tab, setTab] = useState<Tab>("areas");
  const areas = areasQuery.data ?? [];
  const categories = (categoriesQuery.data ?? []).filter((c) => c.kind === "expense");
  const parents = categories.filter((c) => c.parentId === null);

  const categoryRow = (category: (typeof categories)[number], child: boolean) => {
    const children = categories.filter((c) => c.parentId === category.id).length;
    return (
      <SwipeRow
        key={category.id}
        rounded={false}
        actions={editDelete(
          () => router.push(`/category/${category.id}`),
          () => remove(`/categories/${category.id}`, `“${category.name}”`),
        )}
      >
        <View className={`bg-card ${child ? "pl-8" : ""}`}>
          <ListRow
            emoji={category.emoji}
            title={category.name}
            subtitle={[
              BUCKET_LABEL[category.budgetType],
              children ? plural(children, "subcategory", "subcategories") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            chevron
            onPress={() => router.push(`/category/${category.id}`)}
          />
        </View>
      </SwipeRow>
    );
  };

  return (
    <Screen title="Areas & categories" tabBarPadding={false}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "areas", label: `Areas (${areas.length})` },
          { value: "categories", label: `Categories (${categories.length})` },
        ]}
      />
      {tab === "areas" ? (
        <>
          <Text tone="muted" className="px-1">
            The parts of your life tasks and spending belong to, like Work, Home or Health.
          </Text>
          <AsyncContent
            query={areasQuery}
            skeleton={<SkeletonList rows={3} />}
            isEmpty={(data) => data.length === 0}
            empty={
              <EmptyState title="No areas yet" message="Add one, like Work, Home or Health." />
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
          <Button label="New area" icon="plus" onPress={() => router.push("/area/new")} />
        </>
      ) : (
        <>
          <Text tone="muted" className="px-1">
            How spending is sorted. Subcategories sit under their parent in reports and budgets.
          </Text>
          <AsyncContent
            query={categoriesQuery}
            skeleton={<SkeletonList rows={4} />}
            isEmpty={() => parents.length === 0}
            empty={
              <EmptyState
                title="No categories yet"
                message="Add one to start sorting your spending."
              />
            }
          >
            {() => (
              <Group inset={60}>
                {parents.flatMap((parent) => [
                  categoryRow(parent, false),
                  ...categories
                    .filter((c) => c.parentId === parent.id)
                    .map((child) => categoryRow(child, true)),
                ])}
              </Group>
            )}
          </AsyncContent>
          <Button label="New category" icon="plus" onPress={() => router.push("/category/new")} />
        </>
      )}
      <Text variant="caption" tone="muted" className="px-1">
        Tap to change one. Swipe left to delete it; Undo brings it back.
      </Text>
    </Screen>
  );
}
