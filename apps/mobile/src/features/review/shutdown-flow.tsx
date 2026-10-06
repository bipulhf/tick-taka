import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { plural } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { SHUTDOWN_KEY, useShutdown } from "./queries";
import {
  withHabitTicked,
  withHabitUnticked,
  withTopPicked,
  withTopUnpicked,
} from "./shutdown-cache";

type ShutdownData = NonNullable<ReturnType<typeof useShutdown>["data"]>;
type Habit = ShutdownData["habitsUnchecked"][number];
type Candidate = ShutdownData["tomorrowCandidates"][number];

/** A 2-minute evening routine: missed spending, habits, tomorrow's top three. */
export function ShutdownFlow() {
  const router = useRouter();
  const send = useOutbox();
  const actions = useTaskActions();
  const client = useQueryClient();
  const shutdown = useShutdown();
  const [ticked, setTicked] = useState<Habit[]>([]);
  const data = shutdown.data;
  if (!data)
    return (
      <Screen title="Daily shutdown" tabBarPadding={false}>
        {shutdown.isError ? (
          <ErrorState onRetry={() => void shutdown.refetch()} />
        ) : (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </>
        )}
      </Screen>
    );
  const picked = data.tomorrowTopThree.length;
  const patch = (change: (current: ShutdownData) => ShutdownData) =>
    client.setQueryData<ShutdownData>(SHUTDOWN_KEY, (current) => current && change(current));

  // Ticks show at once (and offline); the rows stay put so a tick can be undone.
  const tickHabit = (habit: Habit) => {
    patch((d) => withHabitTicked(d, habit.id));
    setTicked((list) => [...list, habit]);
    send({
      method: "PUT",
      path: `/habits/${habit.id}/logs/${data.date}`,
      body: { count: habit.targetCount },
      label: `Couldn't tick ${habit.name}`,
    });
  };
  const untickHabit = (habit: Habit) => {
    patch((d) => withHabitUnticked(d, habit));
    setTicked((list) => list.filter((h) => h.id !== habit.id));
    send({
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
  return (
    <Screen
      title="Daily shutdown"
      subtitle={`${plural(data.tasksDone, "task")} done today`}
      tabBarPadding={false}
    >
      <Section title="1 · Missed spending?">
        <Card className="gap-2">
          <Text tone="muted">
            {data.transactionsLogged} logged today. Anything paid in cash you forgot?
          </Text>
          <Button
            label="Log spending"
            variant="secondary"
            icon="plus"
            onPress={() => router.push("/add?kind=expense")}
          />
        </Card>
      </Section>
      <Section title="2 · Habits">
        {data.habitsUnchecked.length === 0 && ticked.length === 0 ? (
          <EmptyState
            title="All habits checked"
            message="Lovely. Nothing left to tick off today."
            mood="proud"
          />
        ) : (
          <Card className="gap-1">
            {data.habitsUnchecked.map((habit) => {
              const check = () => tickHabit(habit);
              return (
                // The whole row is the target; the checkbox stays the screen-reader control.
                <Pressable
                  key={habit.id}
                  onPress={check}
                  accessible={false}
                  className="min-h-12 flex-row items-center"
                >
                  <Checkbox tone="grape" checked={false} label={habit.name} onChange={check} />
                  <Text className="flex-1">
                    {habit.emoji} {habit.name}
                  </Text>
                </Pressable>
              );
            })}
            {ticked.length > 0 ? (
              <Text variant="label" tone="muted" className="pt-2">
                Done
              </Text>
            ) : null}
            {ticked.map((habit) => {
              const uncheck = () => untickHabit(habit);
              return (
                <Pressable
                  key={habit.id}
                  onPress={uncheck}
                  accessible={false}
                  className="min-h-12 flex-row items-center"
                >
                  <Checkbox tone="grape" checked label={habit.name} onChange={uncheck} />
                  <Text className="flex-1" tone="muted">
                    {habit.emoji} {habit.name}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        )}
      </Section>
      <Section title={`3 · Tomorrow's top three (${picked}/3)`}>
        {picked === 0 && data.tomorrowCandidates.length === 0 ? (
          <EmptyState
            title="Nothing lined up for tomorrow"
            message="Tomorrow is open. Add a task if something comes to mind."
            actionLabel="Add a task"
            onAction={() => router.push("/add")}
            mood="relaxed"
          />
        ) : (
          <Card className="gap-1">
            {data.tomorrowTopThree.map((task) => {
              const unpick = () => unpickTop(task);
              return (
                <Pressable
                  key={task.id}
                  onPress={unpick}
                  accessible={false}
                  className="min-h-12 flex-row items-center"
                >
                  <Checkbox checked label={task.title} onChange={unpick} />
                  <Text className="flex-1" numberOfLines={1}>
                    ⭐ {task.title}
                  </Text>
                </Pressable>
              );
            })}
            {picked >= 3 ? (
              <Text variant="caption" tone="muted" className="py-2">
                3 of 3 picked. Untick one to swap it.
              </Text>
            ) : (
              data.tomorrowCandidates.slice(0, 8).map((task) => {
                const pick = () => pickTop(task);
                return (
                  <Pressable
                    key={task.id}
                    onPress={pick}
                    accessible={false}
                    className="min-h-12 flex-row items-center"
                  >
                    <Checkbox checked={false} label={task.title} onChange={pick} />
                    <Text className="flex-1" numberOfLines={1}>
                      {task.title}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </Card>
        )}
      </Section>
      <View className="items-center gap-2 py-4">
        <Tiki mood="sleepy" size={84} />
        <Text variant="heading">Good night. The day is closed.</Text>
        <Button label="Done" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
