import { addDays, endOfLocalDay, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate } from "@/lib/format";
import { useAreas, useSettings } from "@/lib/queries";
import { useProjects, useTasks } from "./queries";

type Tab = "inbox" | "upcoming" | "projects";

const LINKS: { href: string; label: string; icon: IconName; flag?: "eisenhower" }[] = [
  { href: "/plan/week", label: "Week", icon: "calendar-week" },
  { href: "/plan/calendar", label: "Calendar", icon: "calendar-month" },
  { href: "/plan/habits", label: "Habits", icon: "repeat" },
  { href: "/plan/routines", label: "Routines", icon: "format-list-checks" },
  { href: "/plan/time", label: "Time", icon: "timer-outline" },
  { href: "/plan/focus-stats", label: "Focus", icon: "sprout" },
  { href: "/plan/someday", label: "Someday", icon: "weather-night" },
  { href: "/plan/logbook", label: "Logbook", icon: "book-check-outline" },
  { href: "/plan/eisenhower", label: "Matrix", icon: "view-grid-outline", flag: "eisenhower" },
];

export function PlanHome() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const today = toLocalDate(Date.now(), timeZone);
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
    const day = toLocalDate(task.doAt!, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  const links = LINKS.filter((link) => !link.flag || settings?.advancedViews[link.flag]);

  return (
    <Screen
      title="Plan"
      subtitle="What's coming and what's waiting?"
      refreshing={inbox.isRefetching}
      onRefresh={() => void inbox.refetch()}
    >
      <View className="flex-row flex-wrap gap-2">
        {links.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href as never)}
            className="w-[31%] items-center gap-1 rounded-2xl bg-card py-3 active:opacity-70"
            accessibilityRole="button"
          >
            <Icon name={link.icon} color="sky" />
            <Text variant="caption" className="font-nunito-bold">
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "inbox", label: `Inbox${inboxTasks.length ? ` · ${inboxTasks.length}` : ""}` },
          { value: "upcoming", label: "Upcoming" },
          { value: "projects", label: "Projects" },
        ]}
      />
      {tab === "inbox" ? (
        inboxTasks.length === 0 ? (
          <EmptyState
            message="Inbox zero. Everything has a home."
            actionLabel="Capture something"
            onAction={() => router.push("/add")}
            mood="proud"
          />
        ) : (
          <View className="gap-2">
            {inboxTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                areaEmoji={areas.find((a) => a.id === task.areaId)?.emoji}
              />
            ))}
          </View>
        )
      ) : null}
      {tab === "upcoming" ? (
        byDay.size === 0 ? (
          <EmptyState
            message="Nothing planned for the next two weeks."
            actionLabel="Open the week planner"
            onAction={() => router.push("/plan/week")}
          />
        ) : (
          [...byDay.entries()].map(([day, tasks]) => (
            <Section key={day} title={formatLocalDate(day, "long")}>
              <View className="gap-2">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    areaEmoji={areas.find((a) => a.id === task.areaId)?.emoji}
                  />
                ))}
              </View>
            </Section>
          ))
        )
      ) : null}
      {tab === "projects" ? (
        <View className="gap-3">
          {areas.map((area) => {
            const count = (projects.data ?? []).filter(
              (p) => p.areaId === area.id && p.status !== "done",
            ).length;
            return (
              <Card
                key={area.id}
                onPress={() => router.push(`/plan/area/${area.id}`)}
                className="flex-row items-center gap-3"
              >
                <Text className="text-2xl">{area.emoji}</Text>
                <View className="flex-1">
                  <Text variant="strong">{area.name}</Text>
                  <Text variant="caption" tone="muted">
                    {count} active project{count === 1 ? "" : "s"}
                  </Text>
                </View>
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color }} />
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
