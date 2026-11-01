import { useNavigate } from "@tanstack/react-router";
import { addMonths } from "@tick-taka/shared/dates";
import { currentWeeklyFocus } from "@tick-taka/shared/weekly-review";
import {
  BarChart3,
  CalendarCheck,
  CalendarFold,
  Flame,
  type LucideIcon,
  Moon,
  NotebookPen,
} from "lucide-react";
import type { ReactNode } from "react";
import { Amount } from "@/components/ui/amount";
import { RowMark } from "@/components/ui/group";
import { CardGrid, ItemCard } from "@/components/ui/item-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { formatLocalDate, formatMonth } from "@/lib/format";
import { useSettings } from "@/lib/queries";
import { useThisMonth } from "@/lib/use-today";
import { streakText } from "./gentle-progress";
import {
  type useGamification,
  useMonthlyReview,
  useShutdown,
  type useWeeklyReview,
} from "./queries";
import { monthlyState, type RitualState, shutdownState, weeklyState } from "./ritual-states";

type Progress = NonNullable<ReturnType<typeof useGamification>["data"]>;
type Weekly = NonNullable<ReturnType<typeof useWeeklyReview>["data"]>;

/** The shutdown has five steps (shutdown-flow.tsx). */
export const SHUTDOWN_STEPS = 5;

/** One figure under a ritual card's title: the number big, what it counts beside it. */
function Figure({ value, label }: { value: ReactNode | undefined; label: string }) {
  return (
    <p className="flex items-baseline gap-2">
      {value === undefined ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-title tabular">{value}</span>
      )}
      <span className="text-callout text-muted">{label}</span>
    </p>
  );
}

/** A quiet line at the card's foot: a streak or what comes next. */
function Foot({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone?: "grape";
  children: ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-caption text-muted">
      <Icon aria-hidden className={tone === "grape" ? "size-4 text-grape-text" : "size-4"} />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

function Ritual({
  id,
  to,
  icon,
  title,
  subtitle,
  state,
  children,
}: {
  id: string;
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  state?: RitualState;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <ItemCard
      dataKey={`ritual:${id}`}
      onOpen={() => void navigate({ to })}
      leading={<RowMark icon={icon} tone="sky" />}
      title={title}
      subtitle={subtitle}
    >
      <div className="flex grow flex-col gap-2">
        {state ? (
          <StatusPill status={state.status} className="self-start">
            {state.label}
          </StatusPill>
        ) : (
          <Skeleton className="h-6 w-24 rounded-full" />
        )}
        <div className="mt-auto flex flex-col gap-2 pt-1">{children}</div>
      </div>
    </ItemCard>
  );
}

/**
 * The four rituals as cards, each with where it stands ("Done tonight", "Due Friday")
 * and one number from its own data, and the streak that goes with it.
 */
export function RitualCards({
  today,
  shutdownProgress,
  game,
  week,
}: {
  today: string;
  shutdownProgress: { step: number; finished: boolean } | null;
  game: Progress | undefined;
  week: Weekly | undefined;
}) {
  const settings = useSettings().data;
  const shutdown = useShutdown().data;
  const thisMonth = useThisMonth();
  const monthly = useMonthlyReview(thisMonth).data;
  const focus = settings ? currentWeeklyFocus(settings, today) : null;
  const budgeted = monthly?.budgets.lines.filter((l) => l.hasBudget) ?? [];
  const kept = budgeted.filter((l) => l.availableMinor >= 0).length;
  const net = monthly?.totals.netMinor;

  return (
    <CardGrid label="Rituals" columns="four">
      <Ritual
        id="shutdown"
        to="/review/shutdown"
        icon={Moon}
        title="Shutdown"
        subtitle="Close the day"
        state={shutdownState(shutdownProgress, SHUTDOWN_STEPS)}
      >
        <Figure value={shutdown?.tasksDone} label="done today" />
        {game && game.dailyGoal.goal > 0 ? (
          <Foot icon={Flame} tone="grape">
            {streakText("Daily goal", game.dailyGoal.streak.current)}
          </Foot>
        ) : null}
      </Ritual>
      <Ritual
        id="weekly"
        to="/review/weekly"
        icon={CalendarCheck}
        title="Weekly review"
        subtitle="Look back on the week"
        state={
          settings?.weeklyReviewDay === undefined
            ? undefined
            : weeklyState(today, settings.weeklyReviewDay)
        }
      >
        <Figure value={week?.wins.tasksDone} label="done this week" />
        <Foot icon={CalendarCheck}>
          {focus
            ? `Focus: ${focus}`
            : settings?.weeklyFocusOn
              ? `Last focus set ${formatLocalDate(settings.weeklyFocusOn)}`
              : "Ends with a focus for next week"}
        </Foot>
      </Ritual>
      <Ritual
        id="monthly"
        to="/review/monthly"
        icon={CalendarFold}
        title="Monthly review"
        subtitle="Budgets vs actual"
        state={monthlyState(today)}
      >
        {monthly && budgeted.length === 0 ? (
          <Figure
            value={<Amount minor={monthly.totals.spentMinor} animate={false} />}
            label="spent so far"
          />
        ) : (
          <Figure
            value={monthly ? `${kept} of ${budgeted.length}` : undefined}
            label="budgets kept so far"
          />
        )}
        <Foot icon={CalendarFold}>Then plan {formatMonth(addMonths(thisMonth, 1))}</Foot>
      </Ritual>
      <Ritual
        id="reports"
        to="/review/reports"
        icon={BarChart3}
        title="Reports"
        subtitle="Time and money"
        state={{ status: "upcoming", label: `${formatMonth(thisMonth)} so far` }}
      >
        <Figure
          value={net === undefined ? undefined : <Amount minor={net} signed animate={false} />}
          label="net this month"
        />
        {game ? (
          <Foot icon={NotebookPen} tone="grape">
            {streakText("Logging", game.loggingStreak.current)}
          </Foot>
        ) : null}
      </Ritual>
    </CardGrid>
  );
}
