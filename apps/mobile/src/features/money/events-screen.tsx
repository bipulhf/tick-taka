import { addDays, toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useEvents } from "./queries";

/** A trip or celebration with its own budget, collecting spending from every account. */
export function EventsScreen() {
  const router = useRouter();
  const send = useOutbox();
  const events = useEvents();
  const today = toLocalDate(Date.now());
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
          <TextField value={name} onChangeText={setName} placeholder="Sylhet trip" autoFocus />
          <TextField
            value={budget}
            onChangeText={setBudget}
            placeholder="Budget (optional)"
            keyboardType="decimal-pad"
          />
          <View className="flex-row gap-2">
            <Chip
              label={`From ${formatLocalDate(startsOn)}`}
              tone="sky"
              selected
              onPress={async () => setStartsOn((await pickDate()) ?? startsOn)}
            />
            <Chip
              label={`To ${formatLocalDate(endsOn)}`}
              tone="sky"
              selected
              onPress={async () => setEndsOn((await pickDate()) ?? endsOn)}
            />
          </View>
          <Button label="Create event" onPress={save} disabled={!name.trim()} />
        </Card>
      ) : null}
      {(events.data ?? []).length === 0 && !adding ? (
        <EmptyState
          message="Group a trip's spending from cash, bKash and card in one place."
          actionLabel="Create an event"
          onAction={() => setAdding(true)}
        />
      ) : null}
      {(events.data ?? []).map((event) => (
        <Card
          key={event.id}
          className="gap-2"
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
                <Amount minor={event.leftMinor ?? 0} variant="caption" tone="ink" animate={false} />{" "}
                left of{" "}
                <Amount minor={event.budgetMinor} variant="caption" tone="muted" animate={false} />
              </Text>
            </>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
