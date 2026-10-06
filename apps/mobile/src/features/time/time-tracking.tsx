import { addDays, startOfLocalDay, startOfWeek, toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { useNow } from "@/features/timer/use-now";
import { formatClock, formatLocalDate, formatMinutes, formatTimer } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAreas, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useRunningTimer, useTimeEntries } from "./queries";

/** Start/stop timer or manual entry, per area, with a billable flag. */
export function TimeTracking() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const today = toLocalDate(Date.now(), timeZone);
  const weekStart = startOfWeek(today, settings?.weekStartsOn ?? 6);
  const from = startOfLocalDay(weekStart, timeZone);
  const to = startOfLocalDay(addDays(weekStart, 7), timeZone);
  const entries = useTimeEntries(from, to);
  const running = useRunningTimer();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [billable, setBillable] = useState(false);
  const active = running.data?.running ?? null;
  const now = useNow(1000, Boolean(active));
  const list = (entries.data ?? []).filter((e) => e.endedAt !== null);
  const minutesOf = (e: { startedAt: number; endedAt: number | null }) =>
    ((e.endedAt ?? now) - e.startedAt) / 60_000;

  const byArea = new Map<string | null, number>();
  for (const entry of list)
    byArea.set(entry.areaId, (byArea.get(entry.areaId) ?? 0) + minutesOf(entry));
  const byDay = new Map<string, typeof list>();
  for (const entry of [...list].reverse()) {
    const day = toLocalDate(entry.startedAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  return (
    <Screen
      title="Time"
      subtitle="Where this week's hours went"
      tabBarPadding={false}
      right={
        <Button
          label="Manual"
          size="sm"
          variant="secondary"
          icon="plus"
          onPress={() => router.push("/time-entry")}
        />
      }
    >
      <AsyncContent query={running} skeleton={<SkeletonCard hero lines={1} />}>
        {() => (
          <Card className="gap-3">
            {active ? (
              <>
                <Text variant="label" tone="muted">
                  Running
                </Text>
                <Text variant="display" numeric>
                  {formatTimer(now - active.startedAt)}
                </Text>
                <Text tone="muted">
                  {areas.find((a) => a.id === active.areaId)?.name ?? "No area"}
                </Text>
                <Button
                  label="Stop"
                  variant="secondary"
                  icon="stop"
                  onPress={() =>
                    send({
                      method: "POST",
                      path: "/timer/stop",
                      body: { endedAt: editTime() },
                      label: "Couldn't stop",
                    })
                  }
                />
              </>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2">
                  {areas.map((area) => (
                    <Chip
                      key={area.id}
                      label={`${area.emoji} ${area.name}`}
                      tone="sky"
                      selected={areaId === area.id}
                      onPress={() => setAreaId(areaId === area.id ? null : area.id)}
                    />
                  ))}
                </View>
                <Chip
                  label={billable ? "Billable" : "Not billable"}
                  tone="mint"
                  selected={billable}
                  onPress={() => setBillable(!billable)}
                />
                <Button
                  label="Start timer"
                  variant="time"
                  icon="play"
                  onPress={() => {
                    send({
                      method: "POST",
                      path: "/timer/start",
                      // The tap time, not the time the queue gets it to the server.
                      body: {
                        id: newId(),
                        areaId,
                        billable,
                        source: "timer",
                        startedAt: editTime(),
                      },
                      label: "Couldn't start",
                    });
                    notify("Timer started");
                  }}
                />
              </>
            )}
          </Card>
        )}
      </AsyncContent>
      <Section title="This week by area">
        <AsyncContent
          query={entries}
          skeleton={<SkeletonList rows={3} leading="none" trailing />}
          isEmpty={() => list.length === 0}
          empty={
            <EmptyState
              title="No time tracked yet"
              message="Start a timer or log time by hand to see where this week's hours go."
              actionLabel="Log time"
              onAction={() => router.push("/time-entry")}
            />
          }
        >
          {() => (
            <Card className="gap-2">
              {[...byArea.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([id, minutes]) => {
                  const area = areas.find((a) => a.id === id);
                  return (
                    <View key={id ?? "none"} className="flex-row justify-between">
                      <Text>{area ? `${area.emoji} ${area.name}` : "No area"}</Text>
                      <Text variant="strong" numeric>
                        {formatMinutes(minutes)}
                      </Text>
                    </View>
                  );
                })}
            </Card>
          )}
        </AsyncContent>
      </Section>
      {[...byDay.entries()].map(([day, dayEntries]) => (
        <Section key={day} title={formatLocalDate(day, "long")}>
          <Card className="gap-2">
            {dayEntries.map((entry) => {
              const title = entry.note || areas.find((a) => a.id === entry.areaId)?.name || "Time";
              const edit = () => router.push(`/time-entry?id=${entry.id}`);
              return (
                <SwipeRow
                  key={entry.id}
                  actions={editDelete(edit, () =>
                    remove(`/time-entries/${entry.id}`, `“${title}”`),
                  )}
                >
                  <SwipeRowPressable
                    onPress={edit}
                    accessibilityHint="Opens the entry. Delete is in the actions menu"
                    className="min-h-12 flex-row items-center justify-between gap-2 bg-card"
                  >
                    <Text className="flex-1" numberOfLines={1}>
                      {entry.source === "focus" ? "🌱 " : ""}
                      {title}
                      {entry.billable ? " · 💵" : ""}
                    </Text>
                    <Text variant="caption" tone="muted" numeric>
                      {formatClock(entry.startedAt, timeZone)} · {formatMinutes(minutesOf(entry))}
                    </Text>
                  </SwipeRowPressable>
                </SwipeRow>
              );
            })}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
