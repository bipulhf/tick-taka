import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { formatMinutes, plural } from "@/lib/format";
import { remove, write } from "@/lib/write";
import { useRoutines } from "./queries";

/** Ordered checklists such as Morning or Shutdown. */
export function RoutineList() {
  const navigate = useNavigate();
  const routines = useRoutines();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const run = (id: string, edit = false) =>
    void navigate({ to: "/plan/routine/$id", params: { id }, search: edit ? { edit: true } : {} });

  const add = async () => {
    if (!name.trim() || adding) return;
    const id = newId();
    setAdding(true);
    try {
      await write({
        method: "POST",
        path: "/routines",
        body: { id, name: name.trim(), emoji: "✨", steps: [] },
        label: "Couldn't add the routine",
      });
      setName("");
      run(id, true);
    } catch {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Routines"
        subtitle="Fewer decisions at the edges of the day"
        back={{ to: "/plan", label: "Plan" }}
      />
      <div className="flex flex-col gap-5">
        {routines.isError && !routines.data ? (
          <ErrorState onRetry={() => void routines.refetch()} />
        ) : !routines.data ? (
          <SkeletonRows rows={2} />
        ) : routines.data.length === 0 ? (
          <EmptyState
            title="No routines yet"
            message="Name one below, like Morning or Shutdown, and the edges of your day get easier."
          />
        ) : (
          <Group as="ul" label="Routines">
            {routines.data.map((routine) => {
              const minutes = routine.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
              const deleteRoutine = () =>
                void remove(`/routines/${routine.id}`, `“${routine.name}”`).catch(() => {});
              return (
                <Row
                  key={routine.id}
                  as="li"
                  dataKey={`routine:${routine.id}`}
                  keyActions={{ remove: deleteRoutine }}
                  className="min-h-[60px]"
                  leading={<RowMark emoji={routine.emoji} />}
                  title={routine.name}
                  subtitle={`${plural(routine.steps.length, "step")}${minutes ? ` · ${formatMinutes(minutes)}` : ""}`}
                  onClick={() => run(routine.id)}
                  trailing={
                    <>
                      <span className="inline-flex items-center gap-1 text-callout font-bold text-sky-text">
                        <Play aria-hidden className="size-4" />
                        Start
                      </span>
                      <Menu
                        items={[
                          { label: "Edit", icon: Pencil, onSelect: () => run(routine.id, true) },
                          "separator",
                          {
                            label: "Delete",
                            icon: Trash2,
                            danger: true,
                            shortcut: "Del",
                            onSelect: deleteRoutine,
                          },
                        ]}
                        trigger={
                          <IconButton
                            icon={MoreHorizontal}
                            label={`More for ${routine.name}`}
                            size="sm"
                            tooltip={false}
                            className="[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          />
                        }
                      />
                    </>
                  }
                />
              );
            })}
          </Group>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <TextField
            aria-label="New routine"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New routine"
            className="flex-1"
          />
          <Button type="submit" icon={Plus} disabled={!name.trim()} loading={adding}>
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}
