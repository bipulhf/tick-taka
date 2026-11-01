import { startOfLocalDay } from "@tick-taka/shared/dates";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useHabits } from "@/features/habits/queries";
import { plural } from "@/lib/format";
import { bestText } from "./gentle-progress";
import { type ShutdownData, useGamification, useUnfinishedBy } from "./queries";

/** "5 days", or a fresh start at zero. */
const days = (n: number) => (n > 0 ? plural(n, "day") : "Fresh start");

/**
 * Each shutdown step's numbers in a strip over it: what got done, what is still open,
 * habits, tomorrow's picks, spending logged. Said by what is done, never by what is short.
 */
export function ShutdownStrip({
  step,
  data,
  ticked,
  timeZone,
}: {
  step: number;
  data: ShutdownData;
  /** Habits ticked during this shutdown. */
  ticked: number;
  timeZone: string;
}) {
  const game = useGamification().data;
  const unfinished = useUnfinishedBy(data.date, timeZone);
  const habits = useHabits({ date: data.date });
  const picked = data.tomorrowTopThree.length;
  const topThree = (
    <StatTile
      label="Tomorrow's top three"
      value={`${picked} of 3`}
      caption={picked === 3 ? "All picked" : "Picked so far"}
    />
  );

  if (step === 0) {
    const goal = game?.dailyGoal;
    return (
      <SummaryStrip label="Today">
        <StatTile label="Tasks done" value={data.tasksDone} caption="Today" />
        {goal && goal.goal > 0 ? (
          <StatTile
            label="Daily goal"
            value={`${Math.min(goal.doneToday, goal.goal)} of ${goal.goal}`}
            caption={goal.reached ? "Reached today" : "Every task counts"}
          />
        ) : null}
        {goal && goal.goal > 0 ? (
          <StatTile
            label="Goal streak"
            value={days(goal.streak.current)}
            caption={bestText(goal.streak.best) ?? "Starts with one day"}
          />
        ) : (
          topThree
        )}
      </SummaryStrip>
    );
  }

  if (step === 1) {
    const left = (unfinished.data ?? []).filter((t) => t.status !== "done");
    const startOfDay = startOfLocalDay(data.date, timeZone);
    const earlier = left.filter((t) => t.doAt !== null && t.doAt < startOfDay).length;
    return (
      <SummaryStrip label="Still open">
        <StatTile
          label="Still open"
          value={left.length}
          caption="Planned for today or before"
          loading={!unfinished.data}
        />
        <StatTile
          label="From earlier days"
          value={earlier}
          caption={earlier ? "Ready for a new day" : "None"}
          loading={!unfinished.data}
        />
        {topThree}
      </SummaryStrip>
    );
  }

  if (step === 2) {
    const daily = (habits.data ?? []).filter((h) => h.schedule === "daily");
    const doneToday = daily.filter((h) => h.doneToday).length;
    return (
      <SummaryStrip label="Habits">
        <StatTile
          label="To tick"
          value={data.habitsUnchecked.length}
          caption={data.habitsUnchecked.length ? "Daily habits" : "All ticked"}
        />
        <StatTile label="Ticked tonight" value={ticked} caption="In this shutdown" />
        <StatTile
          label="Done today"
          value={`${doneToday} of ${daily.length}`}
          caption="Daily habits"
          loading={!habits.data}
        />
      </SummaryStrip>
    );
  }

  if (step === 3)
    return (
      <SummaryStrip label="Tomorrow">
        {topThree}
        <StatTile
          label="Lined up"
          value={data.tomorrowCandidates.length}
          caption="Due by tomorrow"
        />
      </SummaryStrip>
    );

  const logging = game?.loggingStreak;
  return (
    <SummaryStrip label="Spending">
      <StatTile label="Logged today" value={data.transactionsLogged} caption="Transactions" />
      <StatTile
        label="Logging streak"
        value={logging ? days(logging.current) : undefined}
        caption={logging ? (bestText(logging.best) ?? "Starts with one day") : undefined}
        loading={!logging}
      />
    </SummaryStrip>
  );
}
