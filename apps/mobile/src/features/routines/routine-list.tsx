import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatMinutes } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { useRemove } from "@/lib/use-remove";
import { useRoutines } from "./queries";

/** Ordered checklists such as Morning or Shutdown. */
export function RoutineList() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const routines = useRoutines();
  const [name, setName] = useState("");
  return (
    <Screen
      title="Routines"
      subtitle="Fewer decisions at the edges of the day"
      tabBarPadding={false}
    >
      <AsyncContent
        query={routines}
        skeleton={<SkeletonList rows={2} trailing />}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            title="No routines yet"
            message="Name one below, like Morning or Shutdown, and the edges of your day get easier."
          />
        }
      >
        {() =>
          (routines.data ?? []).map((routine) => {
            const minutes = routine.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
            return (
              <SwipeRow
                key={routine.id}
                actions={editDelete(
                  () => router.push(`/routine/${routine.id}?edit=1`),
                  () => remove(`/routines/${routine.id}`, `“${routine.name}”`),
                )}
              >
                <Card
                  onPress={() => router.push(`/routine/${routine.id}`)}
                  className="flex-row items-center gap-3"
                >
                  <Text className="text-3xl">{routine.emoji}</Text>
                  <View className="flex-1">
                    <Text variant="strong">{routine.name}</Text>
                    <Text variant="caption" tone="muted">
                      {routine.steps.length} steps{minutes ? ` · ${formatMinutes(minutes)}` : ""}
                    </Text>
                  </View>
                  <Text tone="sky" variant="strong">
                    Start
                  </Text>
                </Card>
              </SwipeRow>
            );
          })
        }
      </AsyncContent>
      <View className="flex-row gap-2">
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="New routine"
          className="flex-1"
        />
        <Button
          label="Add"
          disabled={!name.trim()}
          onPress={() => {
            const id = newId();
            send({
              method: "POST",
              path: "/routines",
              body: { id, name: name.trim(), emoji: "✨", steps: [] },
              label: "Couldn't add the routine",
            });
            setName("");
            router.push(`/routine/${id}?edit=1`);
          }}
        />
      </View>
    </Screen>
  );
}
