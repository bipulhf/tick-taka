import { newId } from "@tick-taka/shared/ids";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { formatMonth } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useSubscriptions } from "./queries";

/** Charges that repeat at the same amount: track them as bills, or go cancel them. */
export function SubscriptionsScreen() {
  const send = useOutbox();
  const spotted = useSubscriptions();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const list = (spotted.data ?? []).filter((s) => !dismissed.has(s.key));
  const track = (item: (typeof list)[number]) => {
    const day = new Date(item.lastAt).getDate();
    const nextDueAt = item.lastAt + 30 * 86_400_000;
    send({
      method: "POST",
      path: "/recurring",
      body: {
        id: newId(),
        kind: "bill",
        name: item.note ?? "Subscription",
        amountMinor: item.amountMinor,
        accountId: item.accountId,
        categoryId: item.categoryId,
        rrule: `FREQ=MONTHLY;BYMONTHDAY=${day}`,
        nextDueAt,
      },
      label: "Couldn't add the bill",
    });
    notify(`Tracking ${item.note ?? "it"}: ${describeRRule(`FREQ=MONTHLY;BYMONTHDAY=${day}`)}`);
    setDismissed((d) => new Set(d).add(item.key));
  };
  return (
    <Screen title="Subscription spotter" tabBarPadding={false}>
      {list.length === 0 ? (
        <EmptyState
          message="No forgotten repeating charges found."
          actionLabel="Check again"
          onAction={() => void spotted.refetch()}
          mood="relaxed"
        />
      ) : null}
      {list.map((item) => (
        <Card key={item.key} className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="strong">{item.note ?? "Untitled charge"}</Text>
            <Amount minor={item.amountMinor} variant="heading" animate={false} />
          </View>
          <Text variant="caption" tone="muted">
            {item.occurrences} times · {item.months.map(formatMonth).join(", ")}
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Not a subscription"
              size="sm"
              variant="secondary"
              onPress={() => setDismissed((d) => new Set(d).add(item.key))}
              className="flex-1"
            />
            <Button
              label="Track as bill"
              size="sm"
              onPress={() => track(item)}
              className="flex-1"
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
