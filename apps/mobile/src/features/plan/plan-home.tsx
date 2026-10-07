import { addDays, endOfLocalDay, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { ShortcutRow } from "@/components/ui/shortcut-row";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { TASK_ROW_INSET, TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate, plural } from "@/lib/format";
import { useAreas, useSettings } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { useProjects, useTasks } from "./queries";

type Tab = "inbox" | "upcoming" | "projects";

export function PlanHome() {
  const router = useRouter();
  const remove = useRemove();
  const [tab, setTab] = useState<Tab>("inbox");
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = userTime(settings).timeZone;
  const today = useTodayDate();
  const inbox = useTasks({ status: "inbox" });
  const upcoming = useTasks({
    status: "inbox,open",
    from: String(startOfLocalDay(addDays(today, 1), timeZone)),
    to: String(endOfLocalDay(addDays(today, 14), timeZone)),
  });
  const projects = useProjects();
  const inboxTasks = (inbox.data ?? []).filter((t) => t.doAt === null);
  const byDay = new Map<string, NonNullable<typeof upcoming.data>>();
  for (const task of upcoming.data ?? []) {
    if (task.doAt === null) continue;
    const day = toLocalDate(task.doAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  const emoji = (areaId: string | null) => areas.find((a) => a.id === areaId)?.emoji;

  return (
    <Screen title="Plan" refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()}>
      <ShortcutRow
        items={[
          {
            label: "Day",
            icon: "timeline-clock-outline",
            color: "sky",
            onPress: () => router.push(`/plan/day?date=${today}`),
          },
          {
            label: "Week",
            icon: "calendar-week",
            color: "sky",
            onPress: () => router.push("/plan/week"),
          },
          {
            label: "Calendar",
            icon: "calendar-month",
            color: "sky",
            onPress: () => router.push("/plan/calendar"),
          },
          {
            label: "Habits",
            icon: "repeat",
            color: "grape",
            onPress: () => router.push("/plan/habits"),
          },
        ]}
      />
      <Segmented<Tab>
        kind="tabs"
        value={tab}
        onChange={setTab}
        options={[
          { value: "inbox", label: inboxTasks.length ? `Inbox ${inboxTasks.length}` : "Inbox" },
          { value: "upcoming", label: "Upcoming" },
          { value: "projects", label: "Projects" },
        ]}
      />
      {tab === "inbox" ? (
        <AsyncContent
          query={inbox}
          skeleton={<SkeletonList rows={4} />}
          isEmpty={() => inboxTasks.length === 0}
          empty={
            <EmptyState
              title="Inbox zero"
              message="Everything has a home. New ideas land here first."
              actionLabel="Capture something"
              onAction={() => router.push("/add")}
              mood="proud"
            />
          }
        >
          {() => (
            <Group inset={TASK_ROW_INSET}>
              {inboxTasks.map((task) => (
                <TaskRow key={task.id} task={task} areaEmoji={emoji(task.areaId)} />
              ))}
            </Group>
          )}
        </AsyncContent>
      ) : null}
      {tab === "upcoming" ? (
        <AsyncContent
          query={upcoming}
          skeleton={<SkeletonList rows={4} />}
          isEmpty={() => byDay.size === 0}
          empty={
            <EmptyState
              title="Nothing planned yet"
              message="The next two weeks are open. Give a few tasks a day."
              actionLabel="Open the week"
              onAction={() => router.push("/plan/week")}
            />
          }
        >
          {() =>
            [...byDay.entries()].map(([day, tasks]) => (
              <Section key={day} title={formatLocalDate(day, "long")}>
                <Group inset={TASK_ROW_INSET}>
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} areaEmoji={emoji(task.areaId)} />
                  ))}
                </Group>
              </Section>
            ))
          }
        </AsyncContent>
      ) : null}
      {tab === "projects" && projects.data === undefined ? <SkeletonList rows={4} /> : null}
      {tab === "projects" && projects.data !== undefined ? (
        <Group inset={60}>
          {areas.map((area) => {
            const count = (projects.data ?? []).filter(
              (p) => p.areaId === area.id && p.status !== "done",
            ).length;
            return (
              <SwipeRow
                key={area.id}
                rounded={false}
                actions={editDelete(
                  () => router.push(`/area/${area.id}`),
                  () => remove(`/areas/${area.id}`, `“${area.name}”`),
                )}
              >
                <View className="bg-card">
                  <ListRow
                    emoji={area.emoji}
                    title={area.name}
                    subtitle={count ? plural(count, "active project") : "No projects yet"}
                    chevron
                    onPress={() => router.push(`/plan/area/${area.id}`)}
                  />
                </View>
              </SwipeRow>
            );
          })}
          <ListRow
            icon="plus"
            iconColor="sky"
            title="New area"
            subtitle="Work, Home, Health…"
            onPress={() => router.push("/area/new")}
          />
        </Group>
      ) : null}
      <Section title="More">
        <Group inset={60}>
          <ListRow
            icon="format-list-checks"
            iconColor="sky"
            title="Routines"
            subtitle="Morning and shutdown"
            chevron
            onPress={() => router.push("/plan/routines")}
          />
          <ListRow
            icon="timer-outline"
            iconColor="sky"
            title="Time"
            subtitle="Where the hours went"
            chevron
            onPress={() => router.push("/plan/time")}
          />
          <ListRow
            icon="chart-bar"
            iconColor="sky"
            title="Focus statistics"
            chevron
            onPress={() => router.push("/plan/focus-stats")}
          />
          <ListRow
            icon="weather-night"
            iconColor="muted"
            title="Someday"
            subtitle="Ideas parked for later"
            chevron
            onPress={() => router.push("/plan/someday")}
          />
          <ListRow
            icon="book-check-outline"
            iconColor="sky"
            title="Logbook"
            subtitle="Everything finished"
            chevron
            onPress={() => router.push("/plan/logbook")}
          />
          {settings?.advancedViews.eisenhower ? (
            <ListRow
              icon="view-grid-outline"
              iconColor="muted"
              title="Eisenhower matrix"
              chevron
              onPress={() => router.push("/plan/eisenhower")}
            />
          ) : null}
        </Group>
      </Section>
    </Screen>
  );
}
