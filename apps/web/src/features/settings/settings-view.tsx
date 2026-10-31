import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tags,
  UserRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { useIsDesk } from "@/components/ui/use-media";
import { profileStore } from "@/lib/auth";
import { plural } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { useAccounts, useAreas, useCategories, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { AccountSection } from "./account-section";
import { AiSection } from "./ai-section";
import { AreasSection } from "./areas-section";
import { useBrowserNotifications } from "./browser-notifications";
import { DaySection } from "./day-section";
import { GeneralSection } from "./general-section";
import { MoneySection } from "./money-section";
import { RemindersSection } from "./reminders-section";
import type { SectionProps } from "./settings-types";
import { useUpdateSettings } from "./use-update-settings";

export type SettingsSectionId =
  | "general"
  | "day"
  | "money"
  | "areas"
  | "reminders"
  | "ai"
  | "account";

interface SectionDef {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  render: (props: SectionProps) => ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: "general",
    label: "General",
    icon: SlidersHorizontal,
    render: (p) => <GeneralSection {...p} />,
  },
  { id: "day", label: "Your day", icon: Sun, render: (p) => <DaySection {...p} /> },
  { id: "money", label: "Money", icon: Wallet, render: (p) => <MoneySection {...p} /> },
  { id: "areas", label: "Areas and categories", icon: Tags, render: () => <AreasSection /> },
  { id: "reminders", label: "Reminders", icon: Bell, render: (p) => <RemindersSection {...p} /> },
  { id: "ai", label: "Tiki and AI", icon: Sparkles, render: (p) => <AiSection {...p} /> },
  { id: "account", label: "Account and data", icon: UserRound, render: () => <AccountSection /> },
];

export const isSettingsSection = (value: unknown): value is SettingsSectionId =>
  SECTIONS.some((s) => s.id === value);

/** One line under each section's name saying how it is set now. */
function useSummaries(s: SectionProps["s"] | undefined): Record<SettingsSectionId, string> {
  const { data: accounts } = useAccounts();
  const { data: areas } = useAreas();
  const { data: categories } = useCategories();
  const notifications = useBrowserNotifications();
  const profile = useStore(profileStore);
  const hidden = usePrivacy();
  const account = accounts?.find((a) => a.id === s?.defaultAccountId)?.name;
  const expense = categories?.filter((c) => c.kind === "expense").length;
  return {
    general: [
      s?.numerals === "beng" ? "বাংলা digits" : "English digits",
      hidden ? "amounts hidden" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    day: s
      ? [
          s.dailyTaskGoal ? `Goal of ${plural(s.dailyTaskGoal, "task")}` : "No daily goal",
          s.vacationMode ? "on vacation" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "",
    money: [account ?? "No default account", s?.defaultCurrency].filter(Boolean).join(" · "),
    areas: [
      areas ? plural(areas.length, "area") : null,
      expense !== undefined ? plural(expense, "category", "categories") : null,
    ]
      .filter(Boolean)
      .join(" · "),
    reminders: notifications.enabled ? "Browser notifications on" : "Browser notifications off",
    ai: s?.ai.enabled ? "On" : "Off",
    account: profile?.email ?? "Signed in with Google",
  };
}

function SectionLink({
  section,
  summary,
  current,
  variant,
}: {
  section: SectionDef;
  summary: string;
  current: boolean;
  variant: "side" | "hub";
}) {
  return (
    <Link
      to="/settings"
      search={{ section: section.id }}
      aria-current={current ? "page" : undefined}
      className={cx(
        "group/link flex items-center gap-3 rounded-2xl transition-colors",
        variant === "side" ? "px-3 py-2" : "min-h-16 px-4 py-3",
        current ? "bg-card shadow-sm shadow-ink/5" : "hover:bg-line/50",
      )}
    >
      <span
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          current ? "bg-mango/25 text-ink" : "bg-line/60 text-muted group-hover/link:text-ink",
        )}
      >
        <section.icon aria-hidden className="size-4" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-bold text-ink">{section.label}</span>
        {summary ? (
          <span className="block truncate text-caption font-normal text-muted">{summary}</span>
        ) : null}
      </span>
      {variant === "hub" ? <ChevronRight aria-hidden className="size-4 text-muted" /> : null}
    </Link>
  );
}

/**
 * Settings, one section at a time: the list of sections (each saying how it is set) on
 * the left of a wide screen, the chosen section beside it. On a phone the list is its
 * own page and a section opens with a way back. Light or dark is the top bar's button.
 */
export function SettingsView({ section }: { section?: SettingsSectionId }) {
  const { data: s, isError, refetch } = useSettings();
  const update = useUpdateSettings();
  const desk = useIsDesk();
  const summaries = useSummaries(s);
  const current = SECTIONS.find((x) => x.id === section) ?? (desk ? SECTIONS[0] : undefined);

  if (!s)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Settings" />
        {isError ? <ErrorState onRetry={() => void refetch()} /> : <ViewSkeleton />}
      </div>
    );

  const list = (variant: "side" | "hub") => (
    <ul className="flex flex-col gap-1">
      {SECTIONS.map((x) => (
        <li key={x.id}>
          <SectionLink
            section={x}
            summary={summaries[x.id]}
            current={x.id === current?.id}
            variant={variant}
          />
        </li>
      ))}
    </ul>
  );

  if (!current)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Settings" />
        <nav aria-label="Settings sections" className="rounded-3xl bg-card/60 p-2">
          {list("hub")}
        </nav>
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      {desk ? <PageHeader title="Settings" /> : null}
      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-2">{list("side")}</div>
        </nav>
        <section
          aria-labelledby="settings-section-title"
          className="flex max-w-[720px] flex-col gap-4"
        >
          {desk ? null : (
            <Link
              to="/settings"
              search={{}}
              className="inline-flex items-center gap-0.5 self-start rounded-lg py-0.5 pr-1.5 text-callout font-bold text-muted hover:text-ink"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Settings
            </Link>
          )}
          <h2 id="settings-section-title" className="text-title">
            {current.label}
          </h2>
          {current.render({ s, update })}
        </section>
      </div>
    </div>
  );
}
