import { toLocalDate } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useOutbox } from "@/lib/outbox";
import { useTasks } from "./queries";

/** Ideas parked for later. They never show on Today; the monthly review checks them. */
export function SomedayList() {
  const router = useRouter();
  const send = useOutbox();
  const tasks = useTasks({ status: "someday" });
  const list = tasks.data ?? [];
  return (
    <Screen title="Someday" subtitle="Ideas parked for later" tabBarPadding={false}>
      {list.length === 0 ? (
        <EmptyState
          message="No parked ideas. Add one with “someday” in quick-add."
          actionLabel="Add an idea"
          onAction={() => router.push("/add?text=someday%20")}
        />
      ) : (
        list.map((task) => (
          <Card key={task.id} className="flex-row items-center gap-3">
            <Text className="flex-1" onPress={() => router.push(`/task/${task.id}`)}>
              {task.title}
            </Text>
            <Button
              label="Inbox"
              size="sm"
              variant="secondary"
              onPress={() =>
                send({
                  method: "PATCH",
                  path: `/tasks/${task.id}`,
                  body: { status: "inbox", updatedAt: Date.now() },
                })
              }
            />
          </Card>
        ))
      )}
      <View className="h-2" />
      <Text variant="caption" tone="muted">
        Today is {toLocalDate(Date.now())}. Someday can wait.
      </Text>
    </Screen>
  );
}
