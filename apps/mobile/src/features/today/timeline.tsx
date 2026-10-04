import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TaskRow } from "@/features/tasks/task-row";
import { formatClock, formatMinutes } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import type { TodayData } from "@/lib/queries";

type Item = TodayData["timeline"][number];

function DayFitBar({ data }: { data: TodayData }) {
  const send = useOutbox();
  const { plannedMinutes, capacityMinutes, overflowMinutes, isDayOff } = data.dayFit;
  if (plannedMinutes === 0) return null;
  const over = overflowMinutes > 0;
  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="strong">{over ? "Your day doesn't quite fit" : "Your day fits"}</Text>
        <Text variant="caption" tone="muted" numeric>
          {formatMinutes(plannedMinutes)} of {formatMinutes(capacityMinutes)}
          {isDayOff ? " · day off" : ""}
        </Text>
      </View>
      <ProgressBar
        value={plannedMinutes / Math.max(1, capacityMinutes)}
        tone={over ? "coral" : "sky"}
      />
      {over ? (
        <Button
          label={`Move ${formatMinutes(overflowMinutes)} to tomorrow`}
          variant="secondary"
          size="sm"
          icon="arrow-right"
          onPress={() => {
            send({
              method: "POST",
              path: "/tasks/move-low-priority",
              body: { date: data.date, minutesToFree: overflowMinutes },
              label: "Couldn't move tasks",
            });
            notify("Moved the lowest-priority tasks to tomorrow");
          }}
        />
      ) : null}
    </Card>
  );
}

function MoneyItem({ item }: { item: Extract<Item, { kind: "bill" | "payday" }> }) {
  const router = useRouter();
  const send = useOutbox();
  const isBill = item.kind === "bill";
  return (
    <Card className="flex-row items-center gap-3 py-3">
      <Icon name={isBill ? "receipt" : "cash-plus"} color={isBill ? "coral" : "mint"} />
      <Pressable className="flex-1" onPress={() => router.push(`/money/recurring/${item.id}`)}>
        <Text variant="strong">{item.name}</Text>
        <Text variant="caption" tone={item.overdue ? "coral" : "muted"}>
          {item.overdue ? "Overdue" : isBill ? "Due today" : "Payday"} ·{" "}
          <Amount
            minor={item.amountMinor}
            currency={item.currency}
            variant="caption"
            tone="muted"
            animate={false}
          />
        </Text>
      </Pressable>
      <Button
        label={isBill ? "Paid" : "Received"}
        size="sm"
        variant={isBill ? "secondary" : "money"}
        onPress={() => {
          if (!isBill && item.currency !== "BDT") {
            router.push(`/money/recurring/${item.id}`);
            return;
          }
          send({
            method: "POST",
            path: `/recurring/${item.id}/pay`,
            body: { transactionId: newId() },
            label: `Couldn't log ${item.name}`,
          });
          notify(`${item.name} logged`);
        }}
      />
    </Card>
  );
}

export function Timeline({
  data,
  areaEmoji,
}: {
  data: TodayData;
  areaEmoji: (areaId: string | null) => string | undefined;
}) {
  const router = useRouter();
  const topIds = new Set(data.topThree.map((t) => t.id));
  const items = data.timeline.filter((item) => item.kind !== "task" || !topIds.has(item.task.id));
  return (
    <Section title="Timeline" action="Plan" onAction={() => router.push("/plan/week")}>
      <DayFitBar data={data} />
      {items.length === 0 ? (
        <Text tone="muted" className="px-1">
          Nothing scheduled. A calm day.
        </Text>
      ) : (
        <View className="gap-2">
          {items.map((item) => (
            <View
              key={item.kind === "task" ? item.task.id : `${item.kind}-${item.id}`}
              className="flex-row gap-3"
            >
              <View className="w-14 items-end pt-4">
                <Text variant="caption" tone="muted" numeric>
                  {item.at ? formatClock(item.at) : "Any"}
                </Text>
              </View>
              <View className="flex-1">
                {item.kind === "task" ? (
                  <TaskRow
                    task={item.task}
                    today={data.date}
                    areaEmoji={areaEmoji(item.task.areaId)}
                  />
                ) : item.kind === "debt" ? (
                  <Card className="flex-row items-center gap-3 py-3">
                    <Icon name="handshake-outline" color="grape" />
                    <Text className="flex-1">
                      {item.direction === "owed_to_me"
                        ? `${item.person} owes you`
                        : `You owe ${item.person}`}
                    </Text>
                    <Amount minor={item.principalMinor} variant="strong" />
                  </Card>
                ) : (
                  <MoneyItem item={item} />
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}
