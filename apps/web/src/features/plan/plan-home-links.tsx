import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/ui/empty-state";
import { RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { CardGrid, ItemCard, ItemCardSkeletons } from "@/components/ui/item-card";
import { Menu } from "@/components/ui/menu";
import { Section } from "@/components/ui/section";
import { formatMinutes, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { remove } from "@/lib/write";
import { useAllProjects, useAreaSummaries } from "./queries";

/**
 * Areas of life as compact cards: active projects, open tasks and hours this week;
 * each opens its projects.
 */
export function PlanAreas() {
  const navigate = useNavigate();
  const open = useOpenPanel();
  const areas = useAreas();
  const projects = useAllProjects();
  const summaries = useAreaSummaries();
  const loading = !areas.data || !projects.data;
  return (
    <Section id="plan-areas" title="Areas" caption="Areas hold projects; projects hold tasks">
      {(areas.isError || projects.isError) && loading ? (
        <ErrorState
          onRetry={() => {
            void areas.refetch();
            void projects.refetch();
          }}
        />
      ) : loading ? (
        <ItemCardSkeletons count={3} />
      ) : (
        <CardGrid label="Areas">
          {(areas.data ?? []).map((area) => {
            const count = (projects.data ?? []).filter(
              (p) => p.areaId === area.id && p.status !== "done",
            ).length;
            const summary = summaries.data?.find((row) => row.area.id === area.id);
            const drop = () => void remove(`/areas/${area.id}`, `“${area.name}”`).catch(() => {});
            return (
              <ItemCard
                key={area.id}
                dataKey={`area:${area.id}`}
                keyActions={{ remove: drop }}
                onOpen={() => void navigate({ to: "/plan/area/$id", params: { id: area.id } })}
                leading={<RowMark emoji={area.emoji} />}
                title={area.name}
                subtitle={count ? plural(count, "active project") : "No projects yet"}
                menu={
                  <Menu
                    items={[
                      { label: "Edit", icon: Pencil, onSelect: () => open(`area:${area.id}`) },
                      "separator",
                      {
                        label: "Delete",
                        icon: Trash2,
                        danger: true,
                        shortcut: "Del",
                        onSelect: drop,
                      },
                    ]}
                    trigger={
                      <IconButton
                        icon={MoreHorizontal}
                        label={`More for ${area.name}`}
                        size="sm"
                        tooltip={false}
                        className="[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      />
                    }
                  />
                }
              >
                {summary ? (
                  <p className="text-callout text-muted">
                    <span className="font-bold text-ink tabular">{summary.openTasks}</span>{" "}
                    {summary.openTasks === 1 ? "open task" : "open tasks"} ·{" "}
                    {summary.weekMinutes ? (
                      <>
                        <span className="font-bold text-sky-text tabular">
                          {formatMinutes(summary.weekMinutes)}
                        </span>{" "}
                        this week
                      </>
                    ) : (
                      "no time this week"
                    )}
                  </p>
                ) : null}
              </ItemCard>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => open("area:new")}
              className="flex h-full min-h-24 w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong/60 p-4 text-left transition-colors duration-150 hover:bg-line/30 sm:p-5"
            >
              <RowMark icon={Plus} tone="sky" />
              <span>
                <span className="block text-body font-bold">New area</span>
                <span className="block text-callout text-muted">Work, Home, Health…</span>
              </span>
            </button>
          </li>
        </CardGrid>
      )}
    </Section>
  );
}
