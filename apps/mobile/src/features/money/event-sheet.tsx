import { endOfLocalDay } from "@tick-taka/shared/dates";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useEvents } from "./queries";

const EMOJIS = ["✈️", "🎉", "🕌", "🎂", "💍", "🏖️", "🏕️", "🎓", "🛍️"];

type Event = NonNullable<ReturnType<typeof useEvents>["data"]>[number];

/** Edits an event; new events are created inline on the events screen. */
export function EventSheet({ id }: { id: string }) {
  const { data: events } = useEvents();
  const event = events?.find((e) => e.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (!event)
    return (
      <Sheet title="Event">
        <SkeletonForm fields={4} />
      </Sheet>
    );
  return <EventForm event={event} />;
}

function EventForm({ event }: { event: Event }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const [name, setName] = useState(event.name);
  const [emoji, setEmoji] = useState(event.emoji);
  const [budget, setBudget] = useState(event.budgetMinor ? String(toMajor(event.budgetMinor)) : "");
  const [startsOn, setStartsOn] = useState(event.startsOn);
  const [endsOn, setEndsOn] = useState(event.endsOn);
  const save = () => {
    if (!name.trim()) return;
    send({
      method: "PATCH",
      path: `/events/${event.id}`,
      body: {
        name: name.trim(),
        emoji,
        budgetMinor: parseAmountToMinor(budget || "0") || null,
        startsOn,
        endsOn: endsOn < startsOn ? startsOn : endsOn,
        updatedAt: editTime(),
      },
      label: "Couldn't save",
    });
    router.back();
  };
  return (
    <Sheet
      title={event.name}
      footer={
        <View className="flex-row gap-2">
          <DeleteButton
            onPress={() => {
              remove(`/events/${event.id}`, `“${event.name}”`);
              router.back();
            }}
          />
          <Button label="Save" onPress={save} disabled={!name.trim()} className="flex-1" />
        </View>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Sylhet trip" />
      <View className="flex-row flex-wrap gap-2">
        {/* Keep an emoji picked elsewhere selectable instead of silently dropping it. */}
        {(EMOJIS.includes(event.emoji) ? EMOJIS : [event.emoji, ...EMOJIS]).map((e) => (
          <Chip key={e} label={e} tone="mint" selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <TextField
        label="Budget (optional)"
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
        placeholder="15000"
      />
      <View className="flex-row gap-2">
        <Chip
          label={`From ${formatLocalDate(startsOn)}`}
          tone="sky"
          selected
          onPress={async () =>
            setStartsOn((await pickDate(endOfLocalDay(startsOn) - 1)) ?? startsOn)
          }
        />
        <Chip
          label={`To ${formatLocalDate(endsOn)}`}
          tone="sky"
          selected
          onPress={async () => setEndsOn((await pickDate(endOfLocalDay(endsOn) - 1)) ?? endsOn)}
        />
      </View>
    </Sheet>
  );
}
