import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate } from "@/lib/format";
import type { TodayData } from "@/lib/queries";

/** After-work tasks, kept apart from the working day, then the next three bills. */
export function EveningSection({ data }: { data: TodayData }) {
  if (data.evening.length === 0 && data.upcoming.length === 0) return null;
  return (
    <Section title="This evening">
      {data.evening.length > 0 ? (
        <View className="gap-2">
          {data.evening.map((task) => (
            <TaskRow key={task.id} task={task} today={data.date} />
          ))}
        </View>
      ) : null}
      {data.upcoming.length > 0 ? (
        <Card className="gap-2">
          <Text variant="label" tone="muted">
            Coming up
          </Text>
          {data.upcoming.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between">
              <Text>
                {item.kind === "bill" ? "🧾" : "💰"} {item.name}
              </Text>
              <Text variant="caption" tone="muted">
                {formatLocalDate(item.dueDate)} ·{" "}
                <Amount
                  minor={item.amountMinor}
                  currency={item.currency}
                  variant="caption"
                  tone="ink"
                  animate={false}
                />
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Section>
  );
}
