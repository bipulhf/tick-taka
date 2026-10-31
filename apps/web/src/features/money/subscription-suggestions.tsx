import { localParts } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { Repeat } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { formatWhen } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useUserTime } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { useSubscriptions } from "./queries";
import { setDismissed, useDismissed } from "./spotter-dismissed";

type Spotted = NonNullable<ReturnType<typeof useSubscriptions>["data"]>[number];

/**
 * On Bills: charges that repeat at the same amount every month. Track adds one as a
 * bill (with a reminder before it's due) right here; "Not one" hides a charge that
 * isn't a subscription. Nothing shows when there's nothing to suggest.
 */
export function SubscriptionSuggestions() {
  const { timeZone } = useUserTime();
  const spotted = useSubscriptions();
  const dismissed = useDismissed();
  const list = (spotted.data ?? []).filter((s) => !dismissed.includes(s.key));
  if (list.length === 0) return null;

  const hide = (item: Spotted) => {
    const before = dismissed;
    setDismissed([...dismissed, item.key]);
    notify(`Hid ${item.note ?? "that charge"}`, {
      label: "Undo",
      onPress: () => setDismissed(before),
    });
  };
  const track = (item: Spotted) => {
    const day = localParts(item.lastAt, timeZone).day;
    const rrule = `FREQ=MONTHLY;BYMONTHDAY=${day}`;
    fire({
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
      caption="Track one to get a reminder before it's due."
    >
      <Group as="ul" label="Repeating charges">
        {list.map((item) => (
          <Row
            as="li"
            key={item.key}
            leading={<RowMark icon={Repeat} tone="coral" />}
            title={item.note ?? "Untitled charge"}
            subtitle={
              <>
                <Amount minor={item.amountMinor} animate={false} /> a month · last{" "}
                {formatWhen(item.lastAt, false, Date.now(), timeZone)}
              </>
            }
            trailing={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Not a subscription: ${item.note ?? "this charge"}`}
                  onClick={() => hide(item)}
                >
                  Not one
                </Button>
                <Button size="sm" onClick={() => track(item)}>
                  Track
                </Button>
              </>
            }
          />
        ))}
      </Group>
    </Section>
  );
}
