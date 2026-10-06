import { useRouter } from "expo-router";
import { Group } from "@/components/ui/group";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { useFeedbackPrefs } from "@/lib/feedback-prefs";
import { plural } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useAccounts, useAiStatus, useSettings } from "@/lib/queries";
import type { ColorName } from "@/theme/colors";
import { AccountSection } from "./account-section";
import { dollars } from "./ai-settings";
import { ACCENTS } from "./appearance-settings";
import { DAYS } from "./planning-settings";
import { ReminderStatusBanner } from "./reminder-status-banner";

interface Entry {
  href: string;
  title: string;
  subtitle: string;
  icon: IconName;
  color: ColorName;
}

const THEMES = { system: "Follows the phone", light: "Light", dark: "Dark" } as const;

/**
 * Settings as a short menu: each row says what's set now and opens its own page,
 * so nothing here is a wall of chips.
 */
export function SettingsScreen() {
  const router = useRouter();
  const { data: s } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const ai = useAiStatus();
  const privacy = usePrivacy();
  const feedback = useFeedbackPrefs();
  const account = accounts.find((a) => a.id === s?.defaultAccountId)?.name;
  const accent = ACCENTS.find((a) => a.id === (s?.rewardTheme ?? null))?.label;
  const join = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).join(" · ");

  const groups: Entry[][] = [
    [
      {
        href: "/settings/appearance",
        title: "Appearance",
        subtitle: s ? join(THEMES[s.theme], accent) : "Theme, accent, Tiki",
        icon: "palette-outline",
        color: "grape",
      },
      {
        href: "/settings/planning",
        title: "Today and planning",
        subtitle: s
          ? join(
              s.dailyTaskGoal ? `${plural(s.dailyTaskGoal, "task")} a day` : "No daily goal",
              `week starts ${DAYS[s.weekStartsOn]}`,
              s.vacationMode && "on vacation",
            )
          : "Daily goal, days off, focus",
        icon: "calendar-check-outline",
        color: "sky",
      },
      {
        href: "/settings/money",
        title: "Money",
        subtitle: account ? `Default account: ${account}` : "Default accounts",
        icon: "wallet-outline",
        color: "mint",
      },
      {
        href: "/settings/areas",
        title: "Areas and categories",
        subtitle: "Add, rename or remove them",
        icon: "shape-outline",
        color: "mango",
      },
    ],
    [
      {
        href: "/settings/notifications",
        title: "Notifications and sounds",
        subtitle: s
          ? join(
              `Quiet ${s.quietHours.start}–${s.quietHours.end}`,
              feedback.sounds ? "sounds on" : "sounds off",
            )
          : "Quiet hours, sounds",
        icon: "bell-outline",
        color: "mango",
      },
      {
        href: "/settings/privacy",
        title: "Privacy and security",
        subtitle: join(s?.appLock ? "Fingerprint lock on" : "No lock", privacy && "amounts hidden"),
        icon: "shield-lock-outline",
        color: "coral",
      },
      {
        href: "/settings/ai",
        title: "AI",
        subtitle: !ai.data?.configured
          ? "Not set up on the server"
          : s?.ai.enabled
            ? `On · ${dollars(ai.data.monthSpendMicros)} this month`
            : "Off",
        icon: "creation",
        color: "grape",
      },
    ],
    [
      {
        href: "/settings/data",
        title: "Your data",
        subtitle: "Export everything as one file",
        icon: "download-outline",
        color: "muted",
      },
    ],
  ];

  return (
    <Screen title="Settings" tabBarPadding={false}>
      <ReminderStatusBanner />
      {groups.map((entries) => (
        <Group key={entries[0]!.href} inset={60}>
          {entries.map((entry) => (
            <ListRow
              key={entry.href}
              icon={entry.icon}
              iconColor={entry.color}
              title={entry.title}
              subtitle={entry.subtitle}
              chevron
              onPress={() => router.push(entry.href as never)}
            />
          ))}
        </Group>
      ))}
      {/* Signing out and deleting the account come last, away from everyday settings. */}
      <AccountSection />
    </Screen>
  );
}
