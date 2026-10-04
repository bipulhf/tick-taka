import { useQuery } from "@tanstack/react-query";
import { addDays, endOfLocalDay } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { api, unwrap } from "@/lib/api";
import { formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useSettings } from "@/lib/queries";
import { useTaskActions } from "./use-task-actions";

/** Pick the three tasks that matter most for a day. Three is small enough to say no to the rest. */
export function PickTopThreeSheet({ date }: { date: string }) {
  const router = useRouter();
  const actions = useTaskActions();
  const { data: settings } = useSettings();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const candidates = useQuery({
    queryKey: ["tasks", "top3-candidates", date],
    queryFn: () =>
      unwrap(
        api.tasks.$get({
          query: { status: "inbox,open", to: String(endOfLocalDay(addDays(date, 7), timeZone)) },
        }),
      ),
  });
  const inbox = useQuery({
    queryKey: ["tasks", "inbox-undated"],
    queryFn: () => unwrap(api.tasks.$get({ query: { status: "inbox,open" } })),
  });
  const all = [
    ...new Map([...(candidates.data ?? []), ...(inbox.data ?? [])].map((t) => [t.id, t])).values(),
  ];
  const picked = all.filter((t) => t.top3Date === date);
  return (
    <Sheet
      title={`Top three for ${formatLocalDate(date)}`}
      footer={<Button label="Done" onPress={() => router.back()} />}
    >
      <AsyncContent query={candidates} skeleton={<SkeletonList rows={4} />}>
        {() => (
          <AsyncContent
            query={inbox}
            skeleton={<SkeletonList rows={4} />}
            isEmpty={() => all.length === 0}
            empty={
              <EmptyState
                title="No open tasks yet"
                message="Your top three come from open tasks. Capture one to get started."
                actionLabel="Add a task"
                onAction={() => router.push("/add")}
              />
            }
          >
            {() => (
              <>
                <Text tone="muted">{picked.length}/3 picked</Text>
                <View className="gap-1">
                  {all.map((task) => {
                    const selected = task.top3Date === date;
                    return (
                      <View
                        key={task.id}
                        className="flex-row items-center rounded-2xl bg-card pr-3"
                      >
                        <Checkbox
                          checked={selected}
                          tone="sky"
                          label={task.title}
                          onChange={(next) => {
                            if (next && picked.length >= 3) {
                              notify("Top three is full. Swap one out first.");
                              return;
                            }
                            actions.setTopThree(task, next ? date : null);
                          }}
                        />
                        <Text className="flex-1" numberOfLines={2}>
                          {task.title}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </AsyncContent>
        )}
      </AsyncContent>
    </Sheet>
  );
}
