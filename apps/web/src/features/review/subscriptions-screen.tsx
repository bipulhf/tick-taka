import { localParts } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { EyeOff, Repeat } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatWhen, plural } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useUserTime } from "@/lib/use-today";
import { fire } from "@/lib/write";
import { useSubscriptions } from "./queries";
import { setDismissed, useDismissed } from "./spotter-dismissed";

type Spotted = NonNullable<ReturnType<typeof useSubscriptions>["data"]>[number];

/**
 * Charges that repeat at the same amount every month. One click tracks one as a bill
 * (with a reminder before it's due); "Not one" hides a charge that isn't a subscription.
 */
export function SubscriptionsScreen() {
  const { timeZone } = useUserTime();
  const spotted = useSubscriptions();
  const dismissed = useDismissed();
  const all = spotted.data ?? [];
  const list = all.filter((s) => !dismissed.includes(s.key));
  const hiddenCount = all.length - list.length;
  const monthly = list.reduce((sum, s) => sum + s.amountMinor, 0);

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
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Subscriptions"
        subtitle="These charges come back at the same amount every month. Track one to get a reminder before it's due, or hide it if it isn't a subscription."
        back={{ to: "/review", label: "Review" }}
      />
      {!spotted.data ? (
        spotted.isError ? (
          <ErrorState onRetry={() => void spotted.refetch()} />
        ) : (
          <div role="status" aria-label="Loading">
            <SkeletonRows rows={3} />
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState
          title="Nothing repeating"
          message="No untracked monthly charges in the last five months."
          actionLabel="Check again"
          onAction={() => void spotted.refetch()}
          mood="relaxed"
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
          <div className="flex flex-col gap-1 rounded-3xl bg-card p-6">
            <p className="text-callout text-muted">
              {plural(list.length, "repeating charge")}, about
            </p>
            <p className="flex items-baseline gap-2">
              <Amount minor={monthly} animate={false} className="text-hero" />
              <span className="text-body text-muted">a month</span>
            </p>
          </div>
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
                    <IconButton
                      icon={EyeOff}
                      size="sm"
                      label={`Not a subscription: ${item.note ?? "this charge"}`}
                      onClick={() => hide(item)}
                    />
                    <Button size="sm" onClick={() => track(item)}>
                      Track
                    </Button>
                  </>
                }
              />
            ))}
          </Group>
        </div>
      )}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setDismissed([])}
          className="self-center rounded-lg px-3 py-2 text-callout font-bold text-sky-text hover:bg-sky/10"
        >
          Show {plural(hiddenCount, "hidden charge")}
        </button>
      ) : null}
    </div>
  );
}
