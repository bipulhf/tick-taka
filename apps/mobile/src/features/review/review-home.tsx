import { toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { ShortcutRow } from "@/components/ui/shortcut-row";
import { SkeletonCard } from "@/components/ui/skeleton";
import { bestText, streakText } from "@/lib/gentle-progress";
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
    title: "Subscriptions",
    hint: "Monthly charges you aren't tracking yet",
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
    href: "/review/ai-usage",
    title: "AI cost",
    hint: "What AI cost this month, day by day",
    icon: "currency-usd",
    ai: true,
  },
  {
    href: "/settings",
    title: "Settings",
    hint: "Views, goals, AI, sounds, export",
    icon: "cog-outline",
  },
];

export function ReviewHome() {
  const router = useRouter();
  const game = useGamification();
  const ai = useAiStatus();
  const sunday = weekdayOf(toLocalDate(Date.now())) === 0;
  const progress = game.data;
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
      {progress ? (
        <Section title="Streaks">
          <Group inset={60}>
            {progress.dailyGoal.goal > 0 ? (
              <ListRow
                icon="fire"
                iconColor="mango"
                title={streakText("Daily goal", progress.dailyGoal.streak.current)}
                subtitle={[
                  `${progress.dailyGoal.goal} tasks a day`,
                  bestText(progress.dailyGoal.streak.best),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : null}
            <ListRow
              icon="notebook-check-outline"
              iconColor="mint"
              title={streakText("Logging", progress.loggingStreak.current)}
              subtitle="Spending logged on the day it happened"
            />
          </Group>
        </Section>
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
