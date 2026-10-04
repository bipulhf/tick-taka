import { useQuery } from "@tanstack/react-query";
import { weekdayOf } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { api, unwrap } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import type { TodayData } from "@/lib/queries";

/** Overdue rescue: one tap moves every overdue task. No red, no guilt. */
export function OverdueBanner({ data }: { data: TodayData }) {
  const send = useOutbox();
  const count = data.counts.overdue;
  if (count === 0) return null;
  const rescue = (target: "today" | "tomorrow" | "inbox") => {
    send({
      method: "POST",
      path: "/tasks/rescue-overdue",
      body: { target, date: data.date },
      label: "Couldn't move tasks",
    });
    notify(`Moved ${count} task${count === 1 ? "" : "s"} to ${target}`);
  };
  return (
    <Card className="gap-3">
      <Text>
        {count === 1
          ? "1 task slipped past its day. Where should it go?"
          : `${count} tasks slipped past their day. Where should they go?`}
      </Text>
      <View className="flex-row gap-2">
        <Button
          label="Today"
          size="sm"
          variant="secondary"
          onPress={() => rescue("today")}
          className="flex-1"
        />
        <Button
          label="Tomorrow"
          size="sm"
          variant="secondary"
          onPress={() => rescue("tomorrow")}
          className="flex-1"
        />
        <Button
          label="Inbox"
          size="sm"
          variant="secondary"
          onPress={() => rescue("inbox")}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

export function SmsBanner({ count }: { count: number }) {
  const router = useRouter();
  if (count === 0) return null;
  return (
    <Card
      onPress={() => router.push("/money/sms")}
      className="flex-row items-center gap-3 bg-mint/15"
    >
      <Text className="text-xl">✉️</Text>
      <Text variant="strong" className="flex-1">
        {count} new from SMS
      </Text>
      <Text tone="sky" variant="strong">
        Review
      </Text>
    </Card>
  );
}

/** Friday morning: this week's spend vs last week, the top category and a tip; opens the weekly review. */
export function WeeklyRecapCard({ date }: { date: string }) {
  const router = useRouter();
  const friday = weekdayOf(date) === 5;
  const { data } = useQuery({
    queryKey: ["weekly-recap", date],
    queryFn: () => unwrap(api.insights["weekly-recap"].$get({ query: { date } })),
    enabled: friday,
  });
  if (!friday || !data) return null;
  return (
    <Card onPress={() => router.push("/review/weekly")} className="gap-1">
      <Text variant="label" tone="muted">
        Weekly recap
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Amount minor={data.thisWeekMinor} variant="title" />
        <Text variant="caption" tone="muted">
          vs <Amount minor={data.lastWeekMinor} variant="caption" tone="muted" animate={false} />{" "}
          last week
        </Text>
      </View>
      {data.topCategory ? (
        <Text variant="caption" tone="muted">
          Top: {data.topCategory.emoji} {data.topCategory.name}
        </Text>
      ) : null}
      <Text>{data.tip}</Text>
    </Card>
  );
}
