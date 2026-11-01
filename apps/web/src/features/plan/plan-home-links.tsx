import { useNavigate } from "@tanstack/react-router";
import {
  BookCheck,
  CalendarDays,
  CalendarRange,
  Clock,
  ListChecks,
  type LucideIcon,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat2,
  Timer,
  Trash2,
} from "lucide-react";
import { ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { remove } from "@/lib/write";
import { useAllProjects } from "./queries";

/** Areas of life with how many active projects each holds; each opens its projects. */
export function PlanAreas() {
  const navigate = useNavigate();
  const open = useOpenPanel();
  const areas = useAreas();
  const projects = useAllProjects();
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
        <SkeletonRows rows={4} />
      ) : (
        <Group as="ul" label="Areas">
          {(areas.data ?? []).map((area) => {
            const count = (projects.data ?? []).filter(
              (p) => p.areaId === area.id && p.status !== "done",
            ).length;
            return (
              <Row
                key={area.id}
                as="li"
                dataKey={`area:${area.id}`}
                keyActions={{
                  remove: () => void remove(`/areas/${area.id}`, `“${area.name}”`).catch(() => {}),
                }}
                leading={<RowMark emoji={area.emoji} />}
                title={area.name}
                subtitle={count ? plural(count, "active project") : "No projects yet"}
                onClick={() => void navigate({ to: "/plan/area/$id", params: { id: area.id } })}
                trailing={
                  <Menu
                    items={[
                      { label: "Edit", icon: Pencil, onSelect: () => open(`area:${area.id}`) },
                      "separator",
                      {
                        label: "Delete",
                        icon: Trash2,
                        danger: true,
                        shortcut: "Del",
                        onSelect: () =>
                          void remove(`/areas/${area.id}`, `“${area.name}”`).catch(() => {}),
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
                chevron
              />
            );
          })}
          <Row
            as="li"
            leading={<RowMark icon={Plus} tone="sky" />}
            title="New area"
            subtitle="Work, Home, Health…"
            onClick={() => open("area:new")}
          />
        </Group>
      )}
    </Section>
  );
}

interface PlanLink {
  to: string;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  tone: "sky" | "grape" | "neutral";
}
