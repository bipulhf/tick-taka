import { toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatWhen } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickTime } from "@/lib/pick-date";
import { useAreas, useSettings } from "@/lib/queries";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

/** Manual time entry: when it started and how long. */
export function TimeEntrySheet() {
  const router = useRouter();
  const send = useOutbox();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const [minutes, setMinutes] = useState(60);
  const [startedAt, setStartedAt] = useState(() => Date.now() - 60 * 60_000);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(false);
  return (
    <Sheet
      title="Log time"
      footer={
        <Button
          label="Save"
          onPress={() => {
            send({
              method: "POST",
              path: "/time-entries",
              body: {
                id: newId(),
                startedAt,
                endedAt: startedAt + minutes * 60_000,
                areaId,
                note: note || null,
                billable,
                source: "manual",
              },
              label: "Couldn't log time",
            });
            router.back();
          }}
        />
      }
    >
      <TextField value={note} onChangeText={setNote} placeholder="What did you work on?" />
      <Text variant="label" tone="muted">
        How long
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {DURATIONS.map((d) => (
          <Chip
            key={d}
            label={d < 60 ? `${d}m` : `${d / 60}h`}
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
