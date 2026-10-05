import { useQueryClient } from "@tanstack/react-query";
import { toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatMinutes, formatWhen } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickTime } from "@/lib/pick-date";
import { useAreas, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import type { useTimeEntries } from "./queries";

type TimeEntry = NonNullable<ReturnType<typeof useTimeEntries>["data"]>[number];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

/**
 * Manual time entry: when it started and how long. With an `id`, edits that
 * entry, found in whichever week list it was opened from.
 */
export function TimeEntrySheet({ id }: { id?: string }) {
  const client = useQueryClient();
  if (!id) return <TimeEntryForm entry={null} />;
  const entry = client
    .getQueriesData<TimeEntry[]>({ queryKey: ["time-entries"] })
    .flatMap(([, data]) => data ?? [])
    .find((e) => e.id === id && e.endedAt !== null);
  if (!entry)
    return (
      <Sheet title="Time">
        <EmptyState title="Entry not found" message="It may have been deleted on another device." />
      </Sheet>
    );
  return <TimeEntryForm entry={entry} />;
}

function TimeEntryForm({ entry }: { entry: TimeEntry | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const [minutes, setMinutes] = useState(() =>
    entry?.endedAt ? Math.max(1, Math.round((entry.endedAt - entry.startedAt) / 60_000)) : 60,
  );
  const [startedAt, setStartedAt] = useState(() => entry?.startedAt ?? Date.now() - 60 * 60_000);
  const [areaId, setAreaId] = useState<string | null>(entry?.areaId ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [billable, setBillable] = useState(entry?.billable ?? false);
  // An edited entry keeps its own length as a choice, e.g. a 37-minute focus session.
  const durations = DURATIONS.includes(minutes)
    ? DURATIONS
    : [...DURATIONS, minutes].sort((a, b) => a - b);
  const body = {
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    areaId,
    note: note || null,
    billable,
  };
  return (
    <Sheet
      title={entry ? "Edit time" : "Log time"}
      footer={
        <View className="flex-row gap-2">
          {entry ? (
            <DeleteButton
              onPress={() => {
                const area = areas.find((a) => a.id === entry.areaId);
                remove(`/time-entries/${entry.id}`, `“${entry.note || area?.name || "Time"}”`);
                router.back();
              }}
            />
          ) : null}
          <Button
            label="Save"
            className="flex-1"
            onPress={() => {
              if (entry)
                send({
                  method: "PATCH",
                  path: `/time-entries/${entry.id}`,
                  body: { ...body, updatedAt: editTime() },
                  label: "Couldn't save",
                });
              else
                send({
                  method: "POST",
                  path: "/time-entries",
                  body: { id: newId(), ...body, source: "manual" },
                  label: "Couldn't log time",
                });
              router.back();
            }}
          />
        </View>
      }
    >
      <TextField value={note} onChangeText={setNote} placeholder="What did you work on?" />
      <Text variant="label" tone="muted">
        How long
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {durations.map((d) => (
          <Chip
            key={d}
            label={DURATIONS.includes(d) ? (d < 60 ? `${d}m` : `${d / 60}h`) : formatMinutes(d)}
            tone="sky"
            selected={minutes === d}
            onPress={() => setMinutes(d)}
          />
        ))}
      </View>
      <Chip
        label={`Started ${formatWhen(startedAt, true, Date.now(), timeZone)}`}
        tone="sky"
        selected
        onPress={async () => {
          const picked = await pickTime(toLocalDate(startedAt, timeZone), startedAt, timeZone);
          if (picked) setStartedAt(picked);
        }}
      />
      <Text variant="label" tone="muted">
        Area
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {areas.map((area) => (
          <Chip
            key={area.id}
            label={`${area.emoji} ${area.name}`}
            tone="sky"
            selected={areaId === area.id}
            onPress={() => setAreaId(area.id)}
          />
        ))}
      </View>
      <Chip
        label={billable ? "Billable" : "Not billable"}
        tone="mint"
        selected={billable}
        onPress={() => setBillable(!billable)}
      />
    </Sheet>
  );
}
