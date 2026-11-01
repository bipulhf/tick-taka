import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { plural } from "@/lib/format";
import { playSound } from "@/lib/sounds";
import { useUserTime } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { SHUTDOWN_KEY, type ShutdownData, useShutdown } from "./queries";
import {
  withHabitTicked,
  withHabitUnticked,
  withTopPicked,
  withTopUnpicked,
} from "./shutdown-cache";
import { readProgress, type ShutdownProgress, saveProgress } from "./shutdown-progress";
import {
  type Candidate,
  CarryOverStep,
  DoneTodayStep,
  type Habit,
  HabitsStep,
  SpendingStep,
  TopThreeStep,
} from "./shutdown-steps";
import { ShutdownStrip } from "./shutdown-strips";
import { StepButtons, Stepper } from "./stepper";

const storage = () => (typeof sessionStorage === "undefined" ? undefined : sessionStorage);

/** Progress for the shutdown of `date`, kept for this tab. */
function useProgress(date: string | undefined) {
  const [progress, setProgress] = useState<ShutdownProgress<Habit> | null>(null);
  useEffect(() => {
    if (date) setProgress(readProgress<Habit>(storage(), date));
  }, [date]);
  const update = useCallback((change: (p: ShutdownProgress<Habit>) => ShutdownProgress<Habit>) => {
    setProgress((current) => {
      if (!current) return current;
      const next = change(current);
      saveProgress(storage(), next);
      return next;
    });
  }, []);
  return [progress, update] as const;
}

/**
 * A few minutes in the evening, one step at a time: what got done, what carries
 * over, habits, tomorrow's top three and any spending not logged yet.
 */
export function ShutdownFlow() {
  const navigate = useNavigate();
  const actions = useTaskActions();
  const client = useQueryClient();
  const { timeZone } = useUserTime();
  const shutdown = useShutdown();
  const data = shutdown.data;
  const [progress, update] = useProgress(data?.date);
  const onStep = useCallback((step: number) => update((p) => ({ ...p, step })), [update]);

  if (!data || !progress)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Daily shutdown" />
        {shutdown.isError ? (
          <ErrorState onRetry={() => void shutdown.refetch()} />
        ) : (
          <div role="status" aria-label="Loading" className="flex flex-col gap-4">
            <Skeleton className="h-7 w-48" />
            <SkeletonRows rows={4} />
          </div>
        )}
      </div>
    );

  const patch = (change: (current: ShutdownData) => ShutdownData) =>
    client.setQueryData<ShutdownData>(SHUTDOWN_KEY, (current) => current && change(current));
  const tickHabit = (habit: Habit) => {
    patch((d) => withHabitTicked(d, habit.id));
    update((p) => ({ ...p, ticked: [...p.ticked.filter((h) => h.id !== habit.id), habit] }));
    playSound("done");
    fire({
      method: "PUT",
      path: `/habits/${habit.id}/logs/${data.date}`,
      body: { count: habit.targetCount },
      label: `Couldn't tick ${habit.name}`,
    });
  };
  const untickHabit = (habit: Habit) => {
    patch((d) => withHabitUnticked(d, habit));
    update((p) => ({ ...p, ticked: p.ticked.filter((h) => h.id !== habit.id) }));
    fire({
      method: "PUT",
      path: `/habits/${habit.id}/logs/${data.date}`,
      body: { count: habit.todayCount },
      label: `Couldn't untick ${habit.name}`,
    });
  };
  const pickTop = (task: Candidate) => {
    patch((d) => withTopPicked(d, task.id, data.tomorrow));
    actions.setTopThree(task, data.tomorrow);
  };
  const unpickTop = (task: Candidate) => {
    patch((d) => withTopUnpicked(d, task.id));
    actions.setTopThree(task, null);
  };

  const header = (
    <PageHeader title="Daily shutdown" subtitle={`${plural(data.tasksDone, "task")} done today`} />
  );

  if (progress.finished)
    return (
      <div className="flex flex-col gap-7">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-12 text-center">
          <Tiki mood="sleepy" size={96} />
          <h2 className="text-title">Good night. The day is closed.</h2>
          <p className="max-w-sm text-callout text-muted">
            {data.tomorrowTopThree.length
              ? `Tomorrow starts with ${plural(data.tomorrowTopThree.length, "task")} picked.`
              : "Tomorrow starts fresh."}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => update((p) => ({ ...p, finished: false }))}>
              Go over it again
            </Button>
            <Button variant="primary" autoFocus onClick={() => void navigate({ to: "/review" })}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );

  const picked = data.tomorrowTopThree.length;
  const steps = [
    { label: "Done today", hint: plural(data.tasksDone, "task") },
    { label: "Carry over", hint: "Move what's left" },
    {
      label: "Habits",
      hint: data.habitsUnchecked.length ? `${data.habitsUnchecked.length} to tick` : "All ticked",
    },
    { label: "Tomorrow's top three", hint: `${picked}/3 picked` },
    { label: "Missed spending?", hint: `${data.transactionsLogged} logged today` },
  ];
  const step = Math.min(progress.step, steps.length - 1);
  return (
    <div className="flex flex-col gap-7">
      {header}
      <Stepper
        steps={steps}
        step={step}
        onStep={onStep}
        label="Shutdown steps"
        footer={
          <StepButtons
            step={step}
            count={steps.length}
            onStep={onStep}
            finish={
              <Button
                variant="primary"
                onClick={() => {
                  playSound("celebrate");
                  update((p) => ({ ...p, finished: true }));
                }}
              >
                Close the day
              </Button>
            }
          />
        }
      >
        <ShutdownStrip
          step={step}
          data={data}
          ticked={progress.ticked.length}
          timeZone={timeZone}
        />
        {step === 0 ? <DoneTodayStep date={data.date} timeZone={timeZone} /> : null}
        {step === 1 ? (
          <CarryOverStep date={data.date} tomorrow={data.tomorrow} timeZone={timeZone} />
        ) : null}
        {step === 2 ? (
          <HabitsStep
            habits={data.habitsUnchecked}
            ticked={progress.ticked}
            onTick={tickHabit}
            onUntick={untickHabit}
          />
        ) : null}
        {step === 3 ? <TopThreeStep data={data} onPick={pickTop} onUnpick={unpickTop} /> : null}
        {step === 4 ? <SpendingStep logged={data.transactionsLogged} /> : null}
      </Stepper>
    </div>
  );
}
