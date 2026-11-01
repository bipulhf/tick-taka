import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { CardGrid, ItemCard, ItemCardSkeletons } from "@/components/ui/item-card";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { TextField } from "@/components/ui/text-field";
import { formatMinutes, plural } from "@/lib/format";
import { remove, write } from "@/lib/write";
import { type Routine, useRoutines } from "./queries";

const PREVIEW_STEPS = 3;

/** One routine: how many steps and minutes, its first few steps, and Start. */
function RoutineCard({
  routine,
  run,
}: {
  routine: Routine;
  run: (id: string, edit?: boolean) => void;
}) {
  const minutes = routine.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  const deleteRoutine = () =>
    void remove(`/routines/${routine.id}`, `“${routine.name}”`).catch(() => {});
  const shown = routine.steps.slice(0, PREVIEW_STEPS);
  const more = routine.steps.length - shown.length;
  return (
    <ItemCard
      dataKey={`routine:${routine.id}`}
      keyActions={{ remove: deleteRoutine }}
      onOpen={() => run(routine.id)}
      leading={<RowMark emoji={routine.emoji} />}
      title={routine.name}
      subtitle={`${plural(routine.steps.length, "step")}${minutes ? ` · about ${formatMinutes(minutes)}` : ""}`}
      menu={
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
      }
      actions={
        routine.steps.length ? (
          <Button
            size="sm"
            variant="time"
            icon={Play}
            className="self-start"
            onClick={() => run(routine.id)}
            aria-label={`Start ${routine.name}`}
          >
            Start
          </Button>
        ) : (
          <Button
            size="sm"
            icon={Plus}
            className="self-start"
            onClick={() => run(routine.id, true)}
          >
            Add steps
          </Button>
        )
      }
    >
      {shown.length ? (
        <ol className="flex flex-col gap-1 text-callout text-muted">
          {shown.map((step, i) => (
            <li key={step.id} className="flex items-baseline gap-2">
              <span className="w-4 shrink-0 text-caption tabular">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{step.title}</span>
              {step.minutes ? (
                <span className="shrink-0 text-caption tabular">{formatMinutes(step.minutes)}</span>
              ) : null}
            </li>
          ))}
          {more > 0 ? <li className="pl-6 text-caption">and {plural(more, "more step")}</li> : null}
        </ol>
      ) : (
        <p className="text-callout text-muted">No steps yet.</p>
      )}
    </ItemCard>
  );
}

/** Ordered checklists such as Morning or Shutdown, as cards with Start on each. */
export function RoutineList() {
  const navigate = useNavigate();
  const routines = useRoutines();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const field = useRef<HTMLInputElement>(null);
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
  const focusNew = () => {
    field.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    field.current?.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Routines"
        subtitle="Fewer decisions at the edges of the day"
        primary={{ label: "New routine", icon: Plus, onClick: focusNew }}
      />
      {routines.isError && !routines.data ? (
        <ErrorState onRetry={() => void routines.refetch()} />
      ) : !routines.data ? (
        <ItemCardSkeletons count={2} />
      ) : routines.data.length === 0 ? (
        <EmptyState
          title="No routines yet"
          message="Name one below, like Morning or Shutdown, and the edges of your day get easier."
        />
      ) : (
        <CardGrid label="Routines">
          {routines.data.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} run={run} />
          ))}
        </CardGrid>
      )}
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <TextField
          ref={field}
          aria-label="New routine"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name a new routine, like Morning"
          className="flex-1"
        />
        <Button type="submit" icon={Plus} disabled={!name.trim()} loading={adding}>
          Add
        </Button>
      </form>
    </div>
  );
}
