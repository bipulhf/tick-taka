import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { areaColorName, areaColorValue } from "@/features/plan/area-panel";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas, useCategories } from "@/lib/queries";
import { remove } from "@/lib/write";
import { CategoryRules } from "./category-rules";
import { GroupLabel } from "./setting-row";

const BUCKET_LABEL: Record<string, string> = {
  flexible: "Flexible",
  fixed: "Fixed",
  non_monthly: "Non-monthly",
};

/** A row's Edit and Delete, shown on hover or focus at its end. */
function RowMenu({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu
      trigger={
        <IconButton
          icon={MoreHorizontal}
          size="sm"
          label={`More for ${name}`}
          tooltip={false}
          className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        />
      }
      items={[
        { label: "Edit", icon: Pencil, onSelect: onEdit },
        { label: "Delete", icon: Trash2, danger: true, onSelect: onDelete, shortcut: "Del" },
      ]}
    />
  );
}

/**
 * Areas and spending categories as two plain lists, then the rules that sort
 * spending by its note. Click a row to change it; Delete (or its menu) removes it,
 * and Undo brings it back.
 */
export function AreasSection() {
  const open = useOpenPanel();
  const areasQuery = useAreas();
  const categoriesQuery = useCategories();
  const areas = areasQuery.data ?? [];
  const categories = (categoriesQuery.data ?? []).filter((c) => c.kind === "expense");
  const parents = categories.filter((c) => c.parentId === null);

  const categoryRow = (category: (typeof categories)[number], child: boolean) => {
    const children = categories.filter((c) => c.parentId === category.id).length;
    const edit = () => open(`category:${category.id}`);
    const del = () =>
      void remove(`/categories/${category.id}`, `“${category.name}”`).catch(() => {});
    return (
      <Row
        key={category.id}
        dataKey={`category:${category.id}`}
        className={child ? "pl-12" : undefined}
        leading={<RowMark emoji={category.emoji} size={child ? "sm" : "md"} />}
        title={category.name}
        subtitle={[
          BUCKET_LABEL[category.budgetType],
          children ? plural(children, "subcategory", "subcategories") : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        onClick={edit}
        keyActions={{ remove: del }}
        trailing={<RowMenu name={category.name} onEdit={edit} onDelete={del} />}
        chevron
      />
    );
  };

  return (
    <Section
      id="settings-areas"
      title="Areas and categories"
      caption="Click one to change it. Delete removes it; Undo brings it back."
    >
      <GroupLabel>Areas</GroupLabel>
      <p className="-mt-1 px-1 text-callout text-muted">
        The parts of your life tasks and spending belong to, like Work, Home or Health.
      </p>
      {areasQuery.isPending ? (
        <SkeletonRows rows={3} />
      ) : areasQuery.isError && !areasQuery.data ? (
        <ErrorState onRetry={() => void areasQuery.refetch()} />
      ) : areas.length === 0 ? (
        <EmptyState title="No areas yet" message="Add one, like Work, Home or Health." />
      ) : (
        <Group>
          {areas.map((area) => {
            const edit = () => open(`area:${area.id}`);
            const del = () => void remove(`/areas/${area.id}`, `“${area.name}”`).catch(() => {});
            return (
              <Row
                key={area.id}
                dataKey={`area:${area.id}`}
                leading={<RowMark emoji={area.emoji} />}
                title={area.name}
                onClick={edit}
                keyActions={{ remove: del }}
                trailing={
                  <>
                    <span
                      role="img"
                      aria-label={areaColorName(area.color)}
                      className="size-3.5 rounded-full"
                      style={{ backgroundColor: areaColorValue(area.color) }}
                    />
                    <RowMenu name={area.name} onEdit={edit} onDelete={del} />
                  </>
                }
                chevron
              />
            );
          })}
        </Group>
      )}
      <div>
        <Button size="sm" icon={Plus} onClick={() => open("area:new")}>
          New area
        </Button>
      </div>

      <GroupLabel>Categories</GroupLabel>
      <p className="-mt-1 px-1 text-callout text-muted">
        How spending is sorted. Subcategories sit under their parent in reports and budgets.
      </p>
      {categoriesQuery.isPending ? (
        <SkeletonRows rows={4} />
      ) : categoriesQuery.isError && !categoriesQuery.data ? (
        <ErrorState onRetry={() => void categoriesQuery.refetch()} />
      ) : parents.length === 0 ? (
        <EmptyState title="No categories yet" message="Add one to start sorting your spending." />
      ) : (
        <Group>
          {parents.flatMap((parent) => [
            categoryRow(parent, false),
            ...categories.filter((c) => c.parentId === parent.id).map((c) => categoryRow(c, true)),
          ])}
        </Group>
      )}
      <div>
        <Button size="sm" icon={Plus} onClick={() => open("category:new")}>
          New category
        </Button>
      </div>

      <CategoryRules />
    </Section>
  );
}
