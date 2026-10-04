import { useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
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
        <Group>
          {list.map((task) => (
            <ListRow
              key={task.id}
              title={task.title}
              onPress={() => router.push(`/task/${task.id}`)}
              right={
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
              }
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}
