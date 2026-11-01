import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMinutes, plural } from "@/lib/format";
import type { WeeklyData } from "./weekly-steps";

/**
 * Each weekly step's numbers in a strip over it: hours against the plan, spending
 * against the week's share, streaks, wins. The last step (next week's focus) has none.
 */
export function WeeklyStrip({ step, data }: { step: number; data: WeeklyData }) {
  const { wins } = data;
  const focus = (
    <StatTile
      label="Focus"
      tone="time"
      value={formatMinutes(wins.focusMinutes)}
      caption={
        wins.focusSessions ? `In ${plural(wins.focusSessions, "session")}` : "No sessions yet"
      }
    />
  );

  if (step === 0) {
    const tracked = data.hoursVsPlan.reduce((sum, r) => sum + r.trackedMinutes, 0);
    const planned = data.hoursVsPlan.reduce((sum, r) => sum + r.plannedMinutes, 0);
    return (
      <SummaryStrip label="Hours this week">
        <StatTile
          label="Tracked"
          tone="time"
          value={formatMinutes(tracked)}
          caption={`Across ${plural(data.hoursVsPlan.length, "area")}`}
        />
        <StatTile label="Planned" value={formatMinutes(planned)} caption="From tasks this week" />
        {focus}
      </SummaryStrip>
    );
  }

  if (step === 1) {
    const { spentMinor, flexibleWeeklyBudgetMinor: share } = data.spending;
    const left = share - spentMinor;
    return (
      <SummaryStrip label="Spending this week">
        <StatTile label="Spent" tone="out" minor={spentMinor} caption="This week" />
        {share > 0 ? (
          <StatTile label="Weekly share" minor={share} caption="Of the flexible budget" />
        ) : null}
        {share > 0 ? (
          <StatTile
            label={left < 0 ? "Beyond the share" : "Left of the share"}
            tone={left < 0 ? "out" : "in"}
            minor={Math.abs(left)}
            caption={left < 0 ? "Next week is a fresh one" : "Still yours this week"}
          />
        ) : (
          <StatTile
            label="Categories"
            value={data.spending.byCategory.length}
            caption="With spending this week"
          />
        )}
      </SummaryStrip>
    );
  }

  if (step === 2) {
    const going = data.habits.filter((h) => h.streak > 0).length;
    const longest = data.habits.reduce<(typeof data.habits)[number] | null>(
      (top, h) => (h.streak > (top?.streak ?? 0) ? h : top),
      null,
    );
    return (
      <SummaryStrip label="Habits this week">
        <StatTile label="Habits" value={data.habits.length} caption="Being built" />
        <StatTile label="On a streak" value={going} caption={`Of ${data.habits.length}`} />
        <StatTile
          label="Longest streak"
          value={longest ? plural(longest.streak, longest.unit) : "Fresh start"}
          caption={
            longest ? `${longest.emoji ?? ""} ${longest.name}`.trim() : "Starts with one day"
          }
        />
      </SummaryStrip>
    );
  }

  if (step === 3)
    return (
      <SummaryStrip label="Wins this week">
        <StatTile label="Tasks done" value={wins.tasksDone} caption="This week" />
        <StatTile
          label="Top three"
          value={`${wins.topThreeDone} of ${wins.topThreePlanned}`}
          caption="Picked and done"
        />
        {focus}
      </SummaryStrip>
    );

  return null;
}
