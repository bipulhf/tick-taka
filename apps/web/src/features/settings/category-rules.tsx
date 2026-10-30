import { X } from "lucide-react";
import { ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAreas, useCategories, useCategoryRules } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { fire, write } from "@/lib/write";
import { GroupLabel } from "./setting-row";

type Rule = NonNullable<ReturnType<typeof useCategoryRules>["data"]>[number];

/** Deletes a rule with Undo; rules have no restore route, so Undo teaches it again. */
async function deleteRule(rule: Rule) {
  await write({
    method: "DELETE",
    path: `/category-rules/${rule.id}`,
    label: "Couldn't delete the rule",
  });
  notify(`Deleted the rule for “${rule.matchText}”`, {
    label: "Undo",
    onPress: () =>
      fire({
        method: "POST",
        path: "/category-rules",
        body: { matchText: rule.matchText, categoryId: rule.categoryId, areaId: rule.areaId },
        label: "Couldn't undo",
      }),
  });
}

/** Notes that pick their category by themselves, learned from earlier corrections. */
export function CategoryRules() {
  const rules = useCategoryRules();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const list = rules.data ?? [];
  return (
    <>
      <GroupLabel>Category rules</GroupLabel>
      <p className="-mt-1 px-1 text-callout text-muted">
        When you change an expense's category, the same note gets it next time. Delete a rule to
        stop that.
      </p>
      {rules.isPending ? (
        <SkeletonRows rows={2} />
      ) : rules.isError && !rules.data ? (
        <ErrorState onRetry={() => void rules.refetch()} />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong/50 px-4 py-3 text-callout text-muted">
          No rules yet. They appear here as you sort your spending.
        </p>
      ) : (
        <Group>
          {list.map((rule) => {
            const category = categories.find((c) => c.id === rule.categoryId);
            const area = areas.find((a) => a.id === rule.areaId);
            const del = () => void deleteRule(rule).catch(() => {});
            return (
              <Row
                key={rule.id}
                leading={<RowMark emoji={category?.emoji ?? "🏷️"} size="sm" />}
                title={`“${rule.matchText}”`}
                subtitle={[
                  category?.name ?? "No category",
                  area ? `${area.emoji} ${area.name}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <IconButton
                    icon={X}
                    size="sm"
                    label={`Delete the rule for “${rule.matchText}”`}
                    onClick={del}
                  />
                }
              />
            );
          })}
        </Group>
      )}
    </>
  );
}
