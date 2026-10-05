import { useRouter } from "expo-router";
import { View } from "react-native";
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
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useShutdown } from "./queries";

/** A 2-minute evening routine: missed spending, habits, tomorrow's top three. */
export function ShutdownFlow() {
  const router = useRouter();
  const send = useOutbox();
  const actions = useTaskActions();
  const shutdown = useShutdown();
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
        {data.habitsUnchecked.length === 0 ? (
          <EmptyState
            title="All habits checked"
            message="Lovely. Nothing left to tick off today."
            mood="proud"
          />
        ) : (
          <Card className="gap-1">
            {data.habitsUnchecked.map((habit) => (
              <View key={habit.id} className="flex-row items-center">
                <Checkbox
                  tone="grape"
                  checked={false}
                  label={habit.name}
                  onChange={() =>
                    send({
                      method: "PUT",
                      path: `/habits/${habit.id}/logs/${data.date}`,
                      body: { count: habit.targetCount },
                    })
                  }
                />
                <Text>
                  {habit.emoji} {habit.name}
                </Text>
              </View>
            ))}
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
            {data.tomorrowTopThree.map((task) => (
              <Text key={task.id}>⭐ {task.title}</Text>
            ))}
            {data.tomorrowCandidates.slice(0, 8).map((task) => (
              <View key={task.id} className="flex-row items-center">
                <Checkbox
                  checked={false}
                  label={task.title}
                  onChange={() =>
                    picked >= 3
                      ? notify("Three is enough.")
                      : actions.setTopThree(task, data.tomorrow)
                  }
                />
                <Text className="flex-1" numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
            ))}
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
