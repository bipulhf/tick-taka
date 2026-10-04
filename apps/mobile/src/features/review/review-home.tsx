import { toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
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
  return (
    <Screen title="Review" subtitle="How am I doing, and what should change?">
      {level ? (
        <Card onPress={() => router.push("/review/rewards")} className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="heading">✨ Level {level.level}</Text>
            <Text tone="muted" numeric>
              {game.data?.sparks} sparks
            </Text>
          </View>
          <ProgressBar value={level.progress} tone="mango" />
          <Text variant="caption" tone="muted">
            {level.nextLevelSparks - level.sparks} to level {level.level + 1} ·{" "}
            {game.data?.rewards.length} rewards unlocked
          </Text>
        </Card>
      ) : null}
      {ENTRIES.filter((e) => !e.ai || ai.data?.configured).map((entry) => (
        <Card
          key={entry.href}
          onPress={() => router.push(entry.href as never)}
          className={`flex-row items-center gap-3 ${sunday && entry.href === "/review/weekly" ? "border-2 border-mango" : ""}`}
        >
          <Icon name={entry.icon} color="grape" />
          <View className="flex-1">
            <Text variant="strong">{entry.title}</Text>
            <Text variant="caption" tone="muted">
              {entry.hint}
            </Text>
          </View>
          <Icon name="chevron-right" color="muted" />
        </Card>
      ))}
    </Screen>
  );
}
