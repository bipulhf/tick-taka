import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { ToggleRow } from "@/components/ui/toggle";
import { formatMinutes, plural } from "@/lib/format";
import { DaysRow, GroupLabel, LONG_DAYS, SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";
import { browserTimeZone, timeZoneLabel, timeZoneOptions } from "./time-zones";

// Tiki and the server accept values outside the presets; Select lists those as they are.
const goalLabel = (n: number) => (n === 0 ? "Off" : plural(n, "task"));
const numberOptions = (values: number[], label: (n: number) => string) =>
  values.map((n) => ({ value: String(n), label: label(n) }));
const minutes = (n: number) => plural(n, "minute");

/** The daily goal, the week, days off, time zone, focus lengths and the optional views. */
export function PlanningSection({ s, update }: SectionProps) {
  const browser = browserTimeZone();
  const now = Date.now();
  return (
    <Section id="settings-planning" title="Today and planning">
      <Group>
        <SelectRow
          label="Daily task goal"
          value={String(s.dailyTaskGoal)}
          options={numberOptions([0, 3, 5, 7, 10], goalLabel)}
          onChange={(n) => update({ dailyTaskGoal: Number(n) })}
        />
        <SelectRow
          label="Free time on a working day"
          description="What the day-fit bar on Today measures against"
          value={String(s.dayCapacityMinutes)}
          options={numberOptions([240, 360, 480, 600], formatMinutes)}
          onChange={(m) => update({ dayCapacityMinutes: Number(m) })}
        />
        <SelectRow
          label="Week starts on"
          value={String(s.weekStartsOn)}
          options={[6, 0, 1].map((d) => ({ value: String(d), label: LONG_DAYS[d] ?? "" }))}
          onChange={(d) => update({ weekStartsOn: Number(d) })}
        />
        <DaysRow
          label="Workdays"
          description="Repeats like “every workday” follow these"
          value={s.workdays}
          onChange={(workdays) => update({ workdays })}
        />
        <DaysRow label="Days off" value={s.daysOff} onChange={(daysOff) => update({ daysOff })} />
        <ToggleRow
          label="Vacation mode"
          description="Pauses goals so streaks survive"
          checked={s.vacationMode}
          onChange={(on) => update({ vacationMode: on })}
        />
        <SelectRow
          label="Time zone"
          description="Today, reminders and budget days follow it"
          value={s.timeZone}
          options={timeZoneOptions(browser, now)}
          onChange={(zone) => update({ timeZone: zone })}
        />
        {browser && browser !== s.timeZone ? (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <p className="min-w-[12rem] flex-1 text-callout text-muted">
              {`This browser is on ${timeZoneLabel(browser, now)}. Today, reminders and budget days follow the time zone above.`}
            </p>
            <Button size="sm" onClick={() => update({ timeZone: browser })}>
              Use this browser's zone
            </Button>
          </div>
        ) : null}
      </Group>

      <GroupLabel>Focus</GroupLabel>
      <Group>
        <SelectRow
          label="Work"
          value={String(s.focus.workMinutes)}
          options={numberOptions([15, 25, 45, 50, 90], minutes)}
          onChange={(m) => update({ focus: { ...s.focus, workMinutes: Number(m) } })}
        />
        <SelectRow
          label="Break"
          value={String(s.focus.breakMinutes)}
          options={numberOptions([5, 10, 15], minutes)}
          onChange={(m) => update({ focus: { ...s.focus, breakMinutes: Number(m) } })}
        />
      </Group>

      <GroupLabel>Advanced views</GroupLabel>
      <Group>
        <ToggleRow
          label="Eisenhower matrix"
          checked={s.advancedViews.eisenhower}
          onChange={(on) => update({ advancedViews: { ...s.advancedViews, eisenhower: on } })}
        />
        <ToggleRow
          label="Energy tags"
          checked={s.advancedViews.energy}
          onChange={(on) => update({ advancedViews: { ...s.advancedViews, energy: on } })}
        />
        <ToggleRow
          label="Shopping list"
          checked={s.advancedViews.shoppingList}
          onChange={(on) => update({ advancedViews: { ...s.advancedViews, shoppingList: on } })}
        />
      </Group>
    </Section>
  );
}
