import { newId } from "@tick-taka/shared/ids";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { useEffect } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatWhen } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useUserTime } from "@/lib/use-today";
import { useSubscriptions } from "./queries";
import { loadDismissed, setDismissed, useDismissed } from "./spotter-dismissed";

/**
 * On Bills: charges that repeat at the same amount every month. One tap tracks one as
 * a bill (with a reminder before it's due) right here; a swipe hides one that isn't a
 * subscription. Nothing shows when there's nothing to suggest.
 */
export function SubscriptionSuggestions() {
  const { timeZone } = useUserTime();
  const send = useOutbox();
  const spotted = useSubscriptions();
  const dismissed = useDismissed();
  useEffect(() => {
    void loadDismissed();
  }, []);
  const list = (spotted.data ?? []).filter((s) => !dismissed.includes(s.key));
  if (list.length === 0) return null;

  const hide = (item: (typeof list)[number]) => {
    const before = dismissed;
    setDismissed([...dismissed, item.key]);
    notify(`Hid ${item.note ?? "that charge"}`, {
      label: "Undo",
      onPress: () => setDismissed(before),
    });
  };
  const track = (item: (typeof list)[number]) => {
    const day = new Date(item.lastAt).getDate();
    const rrule = `FREQ=MONTHLY;BYMONTHDAY=${day}`;
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
        rrule,
        nextDueAt: item.lastAt + 30 * 86_400_000,
      },
      label: "Couldn't add the bill",
    });
    notify(`Tracking ${item.note ?? "it"}: ${describeRRule(rrule)}`);
  };

  return (
    <Section
      title={
        list.length === 1
          ? "1 charge looks like a subscription"
          : `${list.length} charges look like subscriptions`
      }
    >
      <Text tone="muted" className="px-1">
        Track one to get a reminder before it's due, or swipe it away if it isn't one.
      </Text>
      <Group inset={60}>
        {list.map((item) => (
          <SwipeRow
            key={item.key}
            rounded={false}
            actions={[
              {
                label: "Not one",
                icon: "eye-off-outline",
                tone: "muted",
                onPress: () => hide(item),
              },
            ]}
          >
            <View className="min-h-[68px] flex-row items-center gap-3 bg-card px-4 py-2">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-coral/15">
                <Icon name="repeat-variant" color="coral" size={20} />
              </View>
              <View className="flex-1">
                <Text variant="strong" numberOfLines={1}>
                  {item.note ?? "Untitled charge"}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Amount minor={item.amountMinor} variant="caption" animate={false} />
                  <Text variant="caption" tone="muted">
                    a month · last {formatWhen(item.lastAt, false, Date.now(), timeZone)}
                  </Text>
                </View>
              </View>
              <Button label="Track" size="sm" onPress={() => track(item)} />
            </View>
          </SwipeRow>
        ))}
      </Group>
    </Section>
  );
}
