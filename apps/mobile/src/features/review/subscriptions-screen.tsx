import { newId } from "@tick-taka/shared/ids";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatWhen, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useUserTime } from "@/lib/use-today";
import { useSubscriptions } from "./queries";
import { loadDismissed, setDismissed, useDismissed } from "./spotter-dismissed";

/**
 * Charges that repeat at the same amount every month. One tap tracks one as a bill
 * (with a reminder before it's due); a swipe hides one that isn't a subscription.
 */
export function SubscriptionsScreen() {
  const { timeZone } = useUserTime();
  const send = useOutbox();
  const spotted = useSubscriptions();
  const dismissed = useDismissed();
  useEffect(() => {
    void loadDismissed();
  }, []);
  const all = spotted.data ?? [];
  const list = all.filter((s) => !dismissed.includes(s.key));
  const hidden = all.length - list.length;
  const monthly = list.reduce((sum, s) => sum + s.amountMinor, 0);

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
    <Screen title="Subscriptions" tabBarPadding={false}>
      <Text tone="muted" className="px-1">
        These charges come back at the same amount every month. Track one to get a reminder before
        it's due, or swipe it away if it isn't a subscription.
      </Text>
      <AsyncContent
        query={spotted}
        skeleton={
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={2} />
          </>
        }
        isEmpty={() => list.length === 0}
        empty={
          <EmptyState
            title="Nothing repeating"
            message="No untracked monthly charges in the last five months."
            actionLabel="Check again"
            onAction={() => void spotted.refetch()}
            mood="relaxed"
          />
        }
      >
        {() => (
          <>
            <Card className="gap-1">
              <Text variant="callout" tone="muted">
                {plural(list.length, "repeating charge")}, about
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Amount minor={monthly} variant="display" animate={false} />
                <Text tone="muted">a month</Text>
              </View>
            </Card>
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
          </>
        )}
      </AsyncContent>
      {hidden > 0 ? (
        <Pressable
          onPress={() => setDismissed([])}
          accessibilityRole="button"
          className="min-h-12 items-center justify-center"
        >
          <Text variant="callout" tone="sky">
            Show {plural(hidden, "hidden charge")}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
