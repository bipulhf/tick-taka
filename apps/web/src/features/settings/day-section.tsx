import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { ToggleRow } from "@/components/ui/toggle";
import { formatMinutes, plural } from "@/lib/format";
import { DaysRow, GroupLabel, LONG_DAYS, MoreOptions, PairRow, SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";
import { browserTimeZone, timeZoneLabel, timeZoneOptions } from "./time-zones";

// Tiki and the server accept values outside the presets; Select lists those as they are.
const goalLabel = (n: number) => (n === 0 ? "Off" : plural(n, "task"));
const numberOptions = (values: number[], label: (n: number) => string) =>
  values.map((n) => ({ value: String(n), label: label(n) }));
const minutes = (n: number) => `${n} min`;

/**
 * The day's shape: the goal, workdays, time zone and time off up front; capacity, the
 * week's first day and focus lengths folded under More options.
 */
export function DaySection({ s, update }: SectionProps) {
  const browser = browserTimeZone();
  const now = Date.now();
  return (
    <>
      <Group>
        <SelectRow
          label="Daily task goal"
          description="Finish this many and the day counts toward your streak"
          value={String(s.dailyTaskGoal)}
          options={numberOptions([0, 3, 5, 7, 10], goalLabel)}
          onChange={(n) => update({ dailyTaskGoal: Number(n) })}
        />
        <DaysRow
          label="Workdays"
          description="Repeats like “every workday” follow these"
          value={s.workdays}
          onChange={(workdays) => update({ workdays })}
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
              {`This browser is on ${timeZoneLabel(browser, now)}.`}
            </p>
            <Button size="sm" onClick={() => update({ timeZone: browser })}>
              Use this browser's zone
            </Button>
          </div>
        ) : null}
      </Group>

      <GroupLabel>Time off</GroupLabel>
      <Group>
        <DaysRow
          label="Days off"
          description="No goal on these days"
          value={s.daysOff}
          onChange={(daysOff) => update({ daysOff })}
        />
        <ToggleRow
          label="Vacation mode"
          description="Pauses goals so streaks survive"
          checked={s.vacationMode}
          onChange={(on) => update({ vacationMode: on })}
        />
      </Group>

      <MoreOptions label="More options: capacity, week, focus">
        <Group>
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
          <PairRow
            label="Focus sessions"
            description="Work, then a break"
            first={{
              label: "Work",
              value: String(s.focus.workMinutes),
              options: numberOptions([15, 25, 45, 50, 90], minutes),
              onChange: (m) => update({ focus: { ...s.focus, workMinutes: Number(m) } }),
            }}
            joiner="then"
            second={{
              label: "Break",
              value: String(s.focus.breakMinutes),
              options: numberOptions([5, 10, 15], minutes),
              onChange: (m) => update({ focus: { ...s.focus, breakMinutes: Number(m) } }),
            }}
          />
        </Group>
      </MoreOptions>
    </>
  );
}
