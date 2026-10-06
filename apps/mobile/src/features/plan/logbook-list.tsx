import { addDays, startOfLocalDay, startOfWeek, toLocalDate } from "@tick-taka/shared/dates";
import { useState } from "react";
import { Share, View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatClock, formatLocalDate } from "@/lib/format";
import { useAreas, useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { useTasks } from "./queries";

/** Everything I finished; doubles as a timesheet when a job asks what I did. */
export function LogbookList() {
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = userTime(settings).timeZone;
  const today = toLocalDate(Date.now(), timeZone);
  const [q, setQ] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [weeksBack, setWeeksBack] = useState(0);
  const weekStart = addDays(startOfWeek(today, userTime(settings).weekStartsOn), -7 * weeksBack);
  const done = useTasks({
    status: "done",
    includeSubtasks: "true",
    doneFrom: String(startOfLocalDay(weekStart, timeZone)),
    doneTo: String(startOfLocalDay(addDays(weekStart, 7), timeZone)),
    ...(q ? { q } : {}),
    ...(areaId ? { areaId } : {}),
  });
  const byDay = new Map<string, NonNullable<typeof done.data>>();
  for (const task of done.data ?? []) {
    const day = toLocalDate(task.doneAt!, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  const shareTimesheet = () => {
    const lines = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([day, tasks]) =>
          `${formatLocalDate(day, "long")}\n${tasks.map((t) => `  • ${t.title}`).join("\n")}`,
      );
    const area = areas.find((a) => a.id === areaId);
    void Share.share({
      message: `What I did${area ? ` for ${area.name}` : ""}, week of ${formatLocalDate(weekStart)}\n\n${lines.join("\n\n")}`,
    });
  };
  return (
    <Screen
      title="Logbook"
      subtitle={`Week of ${formatLocalDate(weekStart)}`}
      tabBarPadding={false}
    >
      <TextField value={q} onChangeText={setQ} placeholder="Search finished tasks" />
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label="All areas"
          choice="single"
          selected={!areaId}
          onPress={() => setAreaId(null)}
        />
        {areas.map((area) => (
          <Chip
            key={area.id}
            label={`${area.emoji} ${area.name}`}
            tone="sky"
            choice="single"
            selected={areaId === area.id}
            onPress={() => setAreaId(area.id)}
          />
        ))}
      </View>
      <View className="flex-row gap-2">
        <Button
          label="Earlier"
          variant="secondary"
          size="sm"
          icon="chevron-left"
          onPress={() => setWeeksBack(weeksBack + 1)}
          className="flex-1"
        />
        <Button
          label="Later"
          variant="secondary"
          size="sm"
          disabled={weeksBack === 0}
          onPress={() => setWeeksBack(weeksBack - 1)}
          className="flex-1"
        />
        <Button
          label="Share"
          variant="secondary"
          size="sm"
          icon="share-variant"
          disabled={byDay.size === 0}
          onPress={shareTimesheet}
          className="flex-1"
        />
      </View>
      <AsyncContent
        query={done}
        skeleton={<SkeletonCard lines={3} />}
        isEmpty={() => byDay.size === 0}
        empty={
          <EmptyState
            title="Nothing finished this week yet"
            message="Finished tasks gather here, so you can look back or share a timesheet."
            mood="calm"
          />
        }
      >
        {() => (
          <>
            {[...byDay.entries()].map(([day, tasks]) => (
              <Section key={day} title={formatLocalDate(day, "long")}>
                <Card className="gap-2">
                  {tasks.map((task) => (
                    <View key={task.id} className="flex-row justify-between gap-3">
                      <Text className="flex-1">✓ {task.title}</Text>
                      <Text variant="caption" tone="muted" numeric>
                        {formatClock(task.doneAt!, timeZone)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Section>
            ))}
          </>
        )}
      </AsyncContent>
    </Screen>
  );
}
