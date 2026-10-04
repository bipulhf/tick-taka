import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TaskRow } from "@/features/tasks/task-row";
import { formatClock, formatMinutes } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import type { TodayData } from "@/lib/queries";

type Item = TodayData["timeline"][number];
const SHOWN = 3;

function MoneyRow({ item }: { item: Extract<Item, { kind: "bill" | "payday" }> }) {
  const router = useRouter();
  const send = useOutbox();
  const isBill = item.kind === "bill";
  return (
    <ListRow
      icon={isBill ? "receipt" : "cash-plus"}
      iconColor={isBill ? "coral" : "mint"}
      title={item.name}
      subtitle={item.overdue ? "Overdue" : isBill ? "Due today" : "Payday"}
      onPress={() => router.push(`/money/recurring/${item.id}`)}
      right={
        <Button
          label={isBill ? "Paid" : "Received"}
          size="sm"
          variant="secondary"
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
      }
    />
  );
}

/** The next few things today, after the top three. The full day is one tap away. */
export function NextUp({
  data,
  areaEmoji,
}: {
  data: TodayData;
  areaEmoji: (areaId: string | null) => string | undefined;
}) {
  const router = useRouter();
  const topIds = new Set(data.topThree.map((t) => t.id));
  const now = Date.now();
  const items = data.timeline.filter((item) => {
    if (item.kind !== "task") return true;
    if (topIds.has(item.task.id) || item.task.status === "done") return false;
    return item.at === null || item.at >= now - 30 * 60_000;
  });
  const { plannedMinutes, capacityMinutes } = data.dayFit;
  const subtitle = plannedMinutes
    ? `${formatMinutes(plannedMinutes)} planned of ${formatMinutes(capacityMinutes)}`
    : null;
  const openDay = () => router.push(`/plan/day?date=${data.date}`);
  return (
    <Section title="Next up" action="Full day" onAction={openDay}>
      {subtitle ? (
        <Text
          variant="callout"
          tone={data.dayFit.overflowMinutes > 0 ? "coral" : "muted"}
          className="-mt-2 px-1"
        >
          {subtitle}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <Text variant="callout" tone="muted" className="px-1">
          Nothing else scheduled. A calm day.
        </Text>
      ) : (
        <Group inset={64}>
          {items
            .slice(0, SHOWN)
            .map((item) =>
              item.kind === "task" ? (
                <TaskRow
                  key={item.task.id}
                  task={item.task}
                  today={data.date}
                  showWhen
                  areaEmoji={areaEmoji(item.task.areaId)}
                />
              ) : item.kind === "debt" ? (
                <ListRow
                  key={`debt-${item.id}`}
                  icon="handshake-outline"
                  iconColor="grape"
                  title={
                    item.direction === "owed_to_me"
                      ? `${item.person} owes you`
                      : `You owe ${item.person}`
                  }
                  subtitle={formatClock(item.at)}
                  right={<Amount minor={item.principalMinor} variant="strong" animate={false} />}
                  onPress={() => router.push("/money/debts")}
                />
              ) : (
                <MoneyRow key={`${item.kind}-${item.id}`} item={item} />
              ),
            )}
          {items.length > SHOWN ? (
            <ListRow
              key="more"
              title={`${items.length - SHOWN} more today`}
              chevron
              onPress={openDay}
            />
          ) : null}
        </Group>
      )}
    </Section>
  );
}
