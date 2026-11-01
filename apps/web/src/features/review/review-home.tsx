import { useNavigate } from "@tanstack/react-router";
import { isWeeklyReviewDay } from "@tick-taka/shared/weekly-review";
import { CalendarCheck, Flame, MessagesSquare, Moon, NotebookPen, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useHabits } from "@/features/habits/queries";
import { formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { useAiStatus, useSettings } from "@/lib/queries";
import { assistantOpenStore } from "@/lib/ui-state";
import { useTodayDate } from "@/lib/use-today";
import { bestText, streakText } from "./gentle-progress";
import { useGamification, useWeeklyReview } from "./queries";
import { RitualCards } from "./ritual-cards";
import { readProgress } from "./shutdown-progress";

/** "2 freeze days left this month", the cushion that keeps one missed day from ending a run. */
const freezeText = (left: number) =>
  left > 0 ? `${plural(left, "freeze day")} left this month` : null;

/** Where tonight's shutdown got to in this tab (it keeps its place in sessionStorage). */
function useShutdownProgress(today: string) {
  const [progress, setProgress] = useState<{ step: number; finished: boolean } | null>(null);
  useEffect(() => {
    setProgress(
      readProgress(typeof sessionStorage === "undefined" ? undefined : sessionStorage, today),
    );
  }, [today]);
  return progress;
}

/**
 * Review: this week so far, then the rituals as cards with where each one stands,
 * the streaks, and a way to Tiki and Settings.
 */
export function ReviewHome() {
  const navigate = useNavigate();
  const game = useGamification();
  const ai = useAiStatus();
  const today = useTodayDate();
  const week = useWeeklyReview();
  const habits = useHabits();
  const reviewDay = useSettings().data?.weeklyReviewDay;
  const reviewToday = reviewDay !== undefined && isWeeklyReviewDay(today, reviewDay);
  const shutdown = useShutdownProgress(today);
  const progress = game.data;
  const weekData = week.data;
  const tracked = weekData?.hoursVsPlan.reduce((sum, r) => sum + r.trackedMinutes, 0) ?? 0;
  const planned = weekData?.hoursVsPlan.reduce((sum, r) => sum + r.plannedMinutes, 0) ?? 0;
  const habitList = habits.data ?? [];
  const habitDays = habitList.reduce((sum, h) => sum + h.weekDoneDays, 0);

  const primary = reviewToday
    ? {
        label: "Start weekly review",
        icon: CalendarCheck,
        onClick: () => void navigate({ to: "/review/weekly" }),
      }
    : shutdown && !shutdown.finished
      ? {
          label: shutdown.step > 0 ? "Finish shutdown" : "Start shutdown",
          icon: Moon,
          onClick: () => void navigate({ to: "/review/shutdown" }),
        }
      : undefined;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Review"
        primary={primary}
        summary={
          <SummaryStrip label="This week">
            <StatTile
              label="Tasks done"
              value={weekData?.wins.tasksDone}
              caption={weekData ? `Since ${formatLocalDate(weekData.weekStart)}` : undefined}
              loading={!weekData}
            />
            <StatTile
              label="Hours tracked"
              tone="time"
              value={formatMinutes(tracked)}
              caption={planned ? `${formatMinutes(planned)} planned` : "This week"}
              loading={!weekData}
            />
            <StatTile
              label="Spent"
              tone="out"
              minor={weekData?.spending.spentMinor}
              caption="This week"
              loading={!weekData}
            />
            <StatTile
              label="Habit days"
              value={habitDays}
              caption={
                habitList.length ? `Across ${plural(habitList.length, "habit")}` : "This week"
              }
              loading={!habits.data}
            />
          </SummaryStrip>
        }
      />
      <RitualCards today={today} shutdownProgress={shutdown} game={progress} week={weekData} />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        {progress ? (
          <Section title="Streaks">
            <Group>
              {progress.dailyGoal.goal > 0 ? (
                <Row
                  leading={<RowMark icon={Flame} tone="grape" />}
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
                leading={<RowMark icon={NotebookPen} tone="grape" />}
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
        ) : (
          <div />
        )}
        {/* At phone width Settings lives in Today's header, so without Tiki this is empty. */}
        <Section title="More" className={ai.data?.configured ? undefined : "max-sm:hidden"}>
          {ai.data?.configured ? (
            <Group>
              {/* The chat opens beside the content rather than on a page of its own. */}
              <Row
                leading={<RowMark icon={MessagesSquare} />}
                title="Chat with Tiki"
                subtitle="Ask, add or change anything, by voice too"
                chevron
                onClick={() => assistantOpenStore.set(true)}
              />
            </Group>
          ) : null}
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
        </Section>
      </div>
    </div>
  );
}
