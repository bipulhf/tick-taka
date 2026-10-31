import { useNavigate } from "@tanstack/react-router";
import { isWeeklyReviewDay, weeklyReviewHint } from "@tick-taka/shared/weekly-review";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  CalendarFold,
  Flame,
  LayoutGrid,
  type LucideIcon,
  MessagesSquare,
  Moon,
  NotebookPen,
  Settings,
} from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Group, Row, RowMark } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import { useAiStatus, useSettings } from "@/lib/queries";
import { assistantOpenStore } from "@/lib/ui-state";
import { useTodayDate } from "@/lib/use-today";
import { bestText, streakText } from "./gentle-progress";
import { useGamification } from "./queries";

interface Entry {
  to: string | null;
  title: string;
  hint: string;
  icon: LucideIcon;
  ai?: boolean;
}

/** The rituals used most, as big shortcuts at the top. */
const RITUALS: { to: string; label: string; icon: LucideIcon; tint: string }[] = [
  { to: "/review/shutdown", label: "Shutdown", icon: Moon, tint: "bg-sky/15 text-sky-text" },
  { to: "/review/weekly", label: "Weekly", icon: CalendarCheck, tint: "bg-sky/15 text-sky-text" },
  { to: "/review/reports", label: "Reports", icon: BarChart3, tint: "bg-mint/15 text-mint-text" },
];

const ENTRIES: Entry[] = [
  {
    to: "/review/monthly",
    title: "Monthly review",
    hint: "Budgets vs actual, then plan next month",
    icon: CalendarFold,
  },
  {
    to: "/review/areas",
    title: "Areas",
    hint: "Each part of life at a glance",
    icon: LayoutGrid,
  },
  {
    // The chat opens beside the content rather than on a page of its own.
    to: null,
    title: "Chat with Tiki",
    hint: "Ask, add or change anything, by voice too",
    icon: MessagesSquare,
    ai: true,
  },
  {
    to: "/review/ai-usage",
    title: "AI cost",
    hint: "What AI cost this month, day by day",
    icon: Bot,
    ai: true,
  },
];

/** "2 freeze days left this month", the cushion that keeps one missed day from ending a run. */
const freezeText = (left: number) =>
  left > 0 ? `${plural(left, "freeze day")} left this month` : null;

/** Review: the evening and weekly rituals, streaks, and the reports behind them. */
export function ReviewHome() {
  const navigate = useNavigate();
  const game = useGamification();
  const ai = useAiStatus();
  const today = useTodayDate();
  const reviewDay = useSettings().data?.weeklyReviewDay;
  const reviewToday = reviewDay !== undefined && isWeeklyReviewDay(today, reviewDay);
  const progress = game.data;
  const entries = ENTRIES.filter((e) => !e.ai || ai.data?.configured);
  const go = (entry: Entry) =>
    entry.to ? void navigate({ to: entry.to }) : assistantOpenStore.set(true);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Review" />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-7">
          <nav aria-label="Rituals" className="grid grid-cols-3 gap-2">
            {RITUALS.map((ritual) => (
              <button
                key={ritual.to}
                type="button"
                onClick={() => void navigate({ to: ritual.to })}
                className="flex flex-col items-center gap-2 rounded-2xl py-3 transition-colors hover:bg-line/40"
              >
                <span
                  aria-hidden
                  className={cx(
                    "flex size-12 items-center justify-center rounded-2xl",
                    ritual.tint,
                  )}
                >
                  <ritual.icon className="size-6" strokeWidth={2} />
                </span>
                <span className="text-caption">{ritual.label}</span>
              </button>
            ))}
          </nav>
          {reviewToday ? (
            <Group>
              <Row
                leading={<RowMark icon={CalendarCheck} />}
                title="Weekly review"
                subtitle={weeklyReviewHint(reviewDay)}
                chevron
                onClick={() => void navigate({ to: "/review/weekly" })}
              />
            </Group>
          ) : null}
          {progress ? (
            <Section title="Streaks">
              <Group>
                {progress.dailyGoal.goal > 0 ? (
                  <Row
                    leading={<RowMark icon={Flame} />}
                    title={streakText("Daily goal", progress.dailyGoal.streak.current)}
                    subtitle={[
                      `${plural(progress.dailyGoal.goal, "task")} a day`,
                      bestText(progress.dailyGoal.streak.best),
                      freezeText(progress.dailyGoal.streak.freezesLeftThisMonth),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
                <Row
                  leading={<RowMark icon={NotebookPen} tone="mint" />}
                  title={streakText("Logging", progress.loggingStreak.current)}
                  subtitle={[
                    "Spending logged on the day it happened",
                    freezeText(progress.loggingStreak.freezesLeftThisMonth),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </Group>
            </Section>
          ) : game.isPending ? (
            <div role="status" aria-label="Loading">
              <SkeletonRows rows={2} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-7">
          <Group>
            {entries.map((entry) => (
              <Row
                key={entry.title}
                leading={<RowMark icon={entry.icon} />}
                title={entry.title}
                subtitle={entry.hint}
                chevron
                onClick={() => go(entry)}
              />
            ))}
          </Group>
          {/* Beside the sidebar's Settings; at phone width it lives in Today's header. */}
          <Group className="hidden sm:block">
            <Row
              leading={<RowMark icon={Settings} />}
              title="Settings"
              subtitle="Views, goals, AI, sounds, export"
              chevron
              onClick={() => void navigate({ to: "/settings" })}
            />
          </Group>
        </div>
      </div>
    </div>
  );
}
