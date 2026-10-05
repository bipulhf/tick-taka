import { toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { ShortcutRow } from "@/components/ui/shortcut-row";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAiStatus } from "@/lib/queries";
import type { ColorName } from "@/theme/colors";
import { useGamification } from "./queries";

interface Entry {
  href: string;
  title: string;
  hint: string;
  icon: IconName;
  ai?: boolean;
}

/** The rituals used most, as big shortcuts at the top. */
const RITUALS: { href: string; label: string; icon: IconName; color: ColorName }[] = [
  { href: "/review/shutdown", label: "Shutdown", icon: "weather-night", color: "grape" },
  { href: "/review/weekly", label: "Weekly", icon: "calendar-week", color: "sky" },
  { href: "/review/insights", label: "Reports", icon: "chart-bar", color: "mint" },
  { href: "/review/payday", label: "Payday", icon: "cash-multiple", color: "mango" },
];

const ENTRIES: Entry[] = [
  {
    href: "/review/monthly",
    title: "Monthly review",
    hint: "Budgets, net worth, hourly rates",
    icon: "calendar-month",
  },
  {
    href: "/review/areas",
    title: "Areas",
    hint: "Each part of life at a glance",
    icon: "view-dashboard-outline",
  },
  {
    href: "/review/subscriptions",
    title: "Subscription spotter",
    hint: "Repeating charges worth a look",
    icon: "repeat-variant",
  },
  {
    href: "/assistant",
    title: "Chat with Tiki",
    hint: "Ask, add or change anything, by voice too",
    icon: "chat-processing-outline",
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
      <ShortcutRow
        items={RITUALS.map((ritual) => ({
          label: ritual.label,
          icon: ritual.icon,
          color: ritual.color,
          onPress: () => router.push(ritual.href as never),
        }))}
      />
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
      ) : game.isPending ? (
        <SkeletonCard lines={1} />
      ) : null}
      {sunday ? (
        <Group>
          <ListRow
            icon="calendar-week"
            iconColor="mango"
            title="Weekly review"
            subtitle="It's Sunday, a good day for it"
            chevron
            onPress={() => router.push("/review/weekly")}
          />
        </Group>
      ) : null}
      <Group inset={60}>
        {entries
          .filter((e) => e.href !== "/settings")
          .map((entry) => (
            <ListRow
              key={entry.href}
              icon={entry.icon}
              iconColor="grape"
              title={entry.title}
              subtitle={entry.hint}
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
