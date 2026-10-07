import { addDays, startOfLocalDay } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useRemove } from "@/lib/use-remove";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { useEvents } from "./queries";

/** A trip or celebration with its own budget, collecting spending from every account. */
export function EventsScreen() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const events = useEvents();
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(addDays(today, 3));
  const save = () => {
    send({
      method: "POST",
      path: "/events",
      body: {
        id: newId(),
        name: name.trim(),
        emoji: "✈️",
        budgetMinor: parseAmountToMinor(budget || "0") || null,
        startsOn,
        endsOn: endsOn < startsOn ? startsOn : endsOn,
      },
      label: "Couldn't add the event",
    });
    setAdding(false);
    setName("");
    setBudget("");
  };
  return (
    <Screen
      title="Events"
      tabBarPadding={false}
      right={<Button label="New" size="sm" icon="plus" onPress={() => setAdding(true)} />}
    >
      {adding ? (
        <Card className="gap-2">
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="Sylhet trip"
            accessibilityLabel="Event name"
            autoFocus
          />
          <TextField
            value={budget}
            onChangeText={setBudget}
            placeholder="Budget (optional)"
            keyboardType="decimal-pad"
          />
          <View className="flex-row gap-3">
            <DateField
              label="From"
              span="half"
              value={formatLocalDate(startsOn)}
              onPress={async () =>
                setStartsOn(
                  (await pickDate(startOfLocalDay(startsOn, timeZone), timeZone)) ?? startsOn,
                )
              }
            />
            <DateField
              label="To"
              span="half"
              value={formatLocalDate(endsOn)}
              onPress={async () =>
                setEndsOn((await pickDate(startOfLocalDay(endsOn, timeZone), timeZone)) ?? endsOn)
              }
            />
          </View>
          <Button label="Create event" onPress={save} disabled={!name.trim()} />
        </Card>
      ) : null}
      <AsyncContent
        query={events}
        skeleton={
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        }
        isEmpty={(data) => data.length === 0 && !adding}
        empty={
          <EmptyState
            title="No events yet"
            message="Group a trip's spending from cash, bKash and card in one place."
            actionLabel="Create an event"
            onAction={() => setAdding(true)}
          />
        }
      >
        {(data) =>
          data.map((event) => (
            <SwipeRow
              key={event.id}
              actions={editDelete(
                () => router.push(`/event/${event.id}`),
                () => remove(`/events/${event.id}`, `“${event.name}”`),
              )}
            >
              <Card
                className="gap-2"
                accessibilityHint="Shows its transactions. Edit and delete are in the actions menu"
                onPress={() => router.push(`/money/transactions?eventId=${event.id}`)}
              >
                <View className="flex-row items-center justify-between">
                  <Text variant="strong">
                    {event.emoji} {event.name}
                  </Text>
                  <Amount minor={event.spentMinor} variant="heading" tone="coral" />
                </View>
                <Text variant="caption" tone="muted">
                  {formatLocalDate(event.startsOn)} – {formatLocalDate(event.endsOn)} ·{" "}
                  {event.transactionCount} transactions
                </Text>
                {event.budgetMinor ? (
                  <>
                    <ProgressBar
                      value={event.spentMinor / event.budgetMinor}
                      tone={event.leftMinor !== null && event.leftMinor < 0 ? "coral" : "mint"}
                    />
                    <Text variant="caption" tone="muted">
                      <Amount
                        minor={event.leftMinor ?? 0}
                        variant="caption"
                        tone="ink"
                        animate={false}
                      />{" "}
                      left of{" "}
                      <Amount
                        minor={event.budgetMinor}
                        variant="caption"
                        tone="muted"
                        animate={false}
                      />
                    </Text>
                  </>
                ) : null}
              </Card>
            </SwipeRow>
          ))
        }
      </AsyncContent>
    </Screen>
  );
}
