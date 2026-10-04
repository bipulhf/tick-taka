import { toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAiStatus } from "@/lib/queries";
import { useGamification } from "./queries";

interface Entry {
  href: string;
  title: string;
  hint: string;
  icon: IconName;
  ai?: boolean;
}

const ENTRIES: Entry[] = [
  {
    href: "/review/shutdown",
    title: "Daily shutdown",
    hint: "Two minutes to close the day",
    icon: "weather-night",
  },
  {
    href: "/review/weekly",
    title: "Weekly review",
    hint: "Hours, spending, habits, wins, next focus",
    icon: "calendar-week",
  },
  {
    href: "/review/monthly",
    title: "Monthly review",
    hint: "Budgets, net worth, hourly rates",
    icon: "calendar-month",
  },
  {
    href: "/review/insights",
    title: "Reports",
    hint: "Where the money and the hours went",
    icon: "chart-bar",
  },
  {
    href: "/review/areas",
    title: "Areas",
    hint: "Each part of life at a glance",
    icon: "view-dashboard-outline",
  },
  {
    href: "/review/payday",
    title: "Payday plan",
    hint: "Give every taka a job",
    icon: "cash-multiple",
  },
  {
    href: "/review/subscriptions",
    title: "Subscription spotter",
    hint: "Repeating charges worth a look",
    icon: "repeat-variant",
  },
  {
    href: "/review/ask",
    title: "Ask my data",
    hint: "“How much on transport in September?”",
    icon: "chat-question-outline",
    ai: true,
  },
  {
    href: "/settings",
    title: "Settings",
    hint: "Views, goals, AI, SMS, export",
    icon: "cog-outline",
  },
];

export function ReviewHome() {
  const router = useRouter();
  const game = useGamification();
  const ai = useAiStatus();
  const sunday = weekdayOf(toLocalDate(Date.now())) === 0;
  const level = game.data?.level;
  const entries = ENTRIES.filter((e) => !e.ai || ai.data?.configured);
  const settings = entries.filter((e) => e.href === "/settings");
  return (
    <Screen title="Review">
      {level ? (
        <Card onPress={() => router.push("/review/rewards")} className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="title">Level {level.level}</Text>
            <Text variant="callout" tone="muted" numeric>
              ✨ {game.data?.sparks} sparks
            </Text>
          </View>
          <ProgressBar value={level.progress} tone="mango" />
          <Text variant="callout" tone="muted">
            {level.nextLevelSparks - level.sparks} to level {level.level + 1} ·{" "}
            {game.data?.rewards.length} rewards unlocked
          </Text>
        </Card>
      ) : null}
      <Group inset={60}>
        {entries
          .filter((e) => e.href !== "/settings")
          .map((entry) => (
            <ListRow
              key={entry.href}
              icon={entry.icon}
              iconColor={sunday && entry.href === "/review/weekly" ? "mango" : "grape"}
              title={entry.title}
              subtitle={
                sunday && entry.href === "/review/weekly"
                  ? "It's Sunday, a good day for it"
                  : entry.hint
              }
              chevron
              onPress={() => router.push(entry.href as never)}
            />
          ))}
      </Group>
      <Group inset={60}>
        {settings.map((entry) => (
          <ListRow
            key={entry.href}
            icon={entry.icon}
            iconColor="muted"
            title={entry.title}
            subtitle={entry.hint}
            chevron
            onPress={() => router.push(entry.href as never)}
          />
        ))}
      </Group>
    </Screen>
  );
}
