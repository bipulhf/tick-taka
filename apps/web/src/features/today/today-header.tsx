import { ArrowRightCircle } from "lucide-react";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { formatClock, formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import type { TodayData } from "@/lib/queries";
import { nextThing } from "./next-thing";

/**
 * Date and the day's goal, Tiki with a one-line greeting, the week's focus from the
 * last weekly review, and the next thing to do: compact, so safe-to-spend and the top
 * three sit above the fold.
 */
export function TodayHeader({
  data,
  outfit,
  timeZone,
  focus,
}: {
  data: TodayData;
  outfit: TikiOutfit;
  timeZone: string;
  /** "Next week's focus" from the weekly review, while it is current. */
  focus: string | null;
}) {
  const open = useOpenPanel();
  const goal = data.gamification.dailyGoal;
  const goalText = goal.onVacation
    ? "On vacation"
    : goal.isDayOff
      ? "Day off"
      : `${goal.doneToday} of ${goal.goal} done`;
  const next = nextThing(data, Date.now());
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Tiki mood={data.tiki.mood} size={60} outfit={outfit} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-callout text-muted">
            {formatLocalDate(data.date, "long")} · {goalText}
          </p>
          <h1 className="truncate text-large-title">{data.greeting}</h1>
          <p className="line-clamp-2 text-callout text-muted">{data.tiki.line}</p>
          {focus ? (
            <p className="mt-1 truncate text-callout">
              <span className="text-muted">This week: </span>
              {focus}
            </p>
          ) : null}
        </div>
      </div>
      {next ? (
        <button
          type="button"
          onClick={() => open(`task:${next.id}`)}
          aria-label={`Next: ${next.title}${next.at ? ` at ${formatClock(next.at, timeZone)}` : ""}. Opens the task`}
          className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5 text-left transition-colors hover:bg-line/40 lg:w-[400px] lg:shrink-0"
        >
          <ArrowRightCircle aria-hidden className="size-5 shrink-0 text-sky" />
          <span className="min-w-0 flex-1 truncate text-body font-bold">
            <span className="text-muted">Next: </span>
            {next.title}
          </span>
          {next.at ? (
            <span className="text-callout font-semibold text-sky-text tabular">
              {formatClock(next.at, timeZone)}
            </span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}
