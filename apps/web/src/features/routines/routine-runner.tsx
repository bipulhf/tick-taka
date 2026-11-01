import { Pencil, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { celebrate } from "@/components/ui/confetti";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMinutes } from "@/lib/format";
import { playSound } from "@/lib/sounds";
import { useRoutines } from "./queries";
import { RoutineEditor } from "./routine-editor";
import { StepTimer } from "./step-timer";

const BACK = { to: "/plan/routines", label: "Routines" };

/** Runs a routine as a checklist with optional per-step timers; Edit changes its steps. */
export function RoutineRunner({
  id,
  editing,
  onEditingChange,
}: {
  id: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const routines = useRoutines();
  const routine = routines.data?.find((r) => r.id === id);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = routine?.steps.length ?? 0;
  const doneCount = routine ? routine.steps.filter((s) => checked.has(s.id)).length : 0;
  const allDone = total > 0 && doneCount === total;
  const minutes = routine?.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0) ?? 0;
  const minutesLeft =
    routine?.steps
      .filter((s) => !checked.has(s.id))
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0) ?? 0;
  useEffect(() => {
    if (allDone) celebrate();
  }, [allDone]);

  if (!routine)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Routine" back={BACK} />
        {routines.isError ? (
          <ErrorState onRetry={() => void routines.refetch()} />
        ) : routines.data ? (
          <EmptyState title="That routine is no longer here" message="It may have been deleted." />
        ) : (
          <div role="status" aria-label="Loading" className="flex flex-col gap-4">
            <Skeleton className="h-2.5 w-full" />
            <SkeletonRows rows={4} />
          </div>
        )}
      </div>
    );

  const toggle = (stepId: string, on: boolean) => {
    if (on) playSound("pop");
    setChecked((set) => {
      const next = new Set(set);
      if (on) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={`${routine.emoji} ${routine.name}`}
        back={BACK}
        summary={
          editing || total === 0 ? undefined : (
            <SummaryStrip label={`${routine.name} at a glance`}>
              <StatTile label="Steps" value={total} caption="One at a time" />
              <StatTile
                label="Time"
                tone="time"
                value={minutes ? formatMinutes(minutes) : "No timers"}
                caption={
                  minutes
                    ? minutesLeft && doneCount
                      ? `${formatMinutes(minutesLeft)} to go`
                      : "With every step's timer"
                    : "Steps run at your pace"
                }
              />
              <StatTile
                label="Done"
                value={`${doneCount} of ${total}`}
                caption={allDone ? "All done" : doneCount ? "Keep going" : "Ready when you are"}
              />
            </SummaryStrip>
          )
        }
        actions={
          editing ? null : (
            <>
              {checked.size > 0 ? (
                <Button icon={RotateCcw} variant="ghost" onClick={() => setChecked(new Set())}>
                  Start over
                </Button>
              ) : null}
              <Button icon={Pencil} onClick={() => onEditingChange(true)}>
                Edit
              </Button>
            </>
          )
        }
      />
      {editing ? (
        <RoutineEditor routine={routine} onDone={() => onEditingChange(false)} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <ProgressBar value={total ? doneCount / total : 0} tone="sky" label="Steps done" />
            {total ? (
              <p className="sr-only" aria-live="polite">
                {doneCount} of {total} done
              </p>
            ) : null}
          </div>
          {total === 0 ? (
            <EmptyState
              title="No steps yet"
              message="Add a few small steps and this routine runs itself."
              actionLabel="Add steps"
              onAction={() => onEditingChange(true)}
            />
          ) : (
            <Group as="ol" label="Steps">
              {routine.steps.map((step) => {
                const on = checked.has(step.id);
                return (
                  <li key={step.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                    <Checkbox
                      checked={on}
                      label={step.title}
                      onChange={(next) => toggle(step.id, next)}
                    />
                    <span
                      className={cx(
                        "flex-1 text-body",
                        on && "text-muted line-through decoration-line-strong",
                      )}
                    >
                      {step.title}
                    </span>
                    {step.minutes ? <StepTimer minutes={step.minutes} /> : null}
                  </li>
                );
              })}
            </Group>
          )}
          {allDone ? (
            <p role="status" className="text-center text-heading">
              All done. Nicely closed. ✨
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
