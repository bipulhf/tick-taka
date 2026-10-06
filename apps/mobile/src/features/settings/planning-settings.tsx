import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Section } from "@/components/ui/section";
import { formatMinutes } from "@/lib/format";
import { ChoiceRow, ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The daily goal, days off, focus timer lengths and the optional planning views. */
export function PlanningSettings() {
  const update = useUpdateSettings();
  return (
    <SettingsPage title="Today and planning">
      {(s) => (
        <>
          <Section title="Today">
            <Card className="gap-1">
              <ChoiceRow label="Daily task goal">
                {[0, 3, 5, 7, 10].map((n) => (
                  <Chip
                    key={n}
                    label={n === 0 ? "Off" : String(n)}
                    selected={s.dailyTaskGoal === n}
                    onPress={() => update({ dailyTaskGoal: n })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow label="Days off">
                {DAYS.map((day, i) => (
                  <Chip
                    key={day}
                    label={day}
                    tone="sky"
                    selected={s.daysOff.includes(i)}
                    onPress={() =>
                      update({
                        daysOff: s.daysOff.includes(i)
                          ? s.daysOff.filter((d) => d !== i)
                          : [...s.daysOff, i],
                      })
                    }
                  />
                ))}
              </ChoiceRow>
              <ToggleRow
                label="Vacation mode"
                hint="Pauses goals so streaks survive"
                value={s.vacationMode}
                onChange={(on) => update({ vacationMode: on })}
              />
              <ChoiceRow label="Free time on a working day">
                {[240, 360, 480, 600].map((m) => (
                  <Chip
                    key={m}
                    label={formatMinutes(m)}
                    tone="sky"
                    selected={s.dayCapacityMinutes === m}
                    onPress={() => update({ dayCapacityMinutes: m })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow label="Week starts on">
                {[6, 0, 1].map((d) => (
                  <Chip
                    key={d}
                    label={DAYS[d]!}
                    selected={s.weekStartsOn === d}
                    onPress={() => update({ weekStartsOn: d })}
                  />
                ))}
              </ChoiceRow>
            </Card>
          </Section>
          <Section title="Focus">
            <Card className="gap-1">
              <ChoiceRow label="Work">
                {[15, 25, 45, 50, 90].map((m) => (
                  <Chip
                    key={m}
                    label={`${m}m`}
                    tone="sky"
                    selected={s.focus.workMinutes === m}
                    onPress={() => update({ focus: { ...s.focus, workMinutes: m } })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow label="Break">
                {[5, 10, 15].map((m) => (
                  <Chip
                    key={m}
                    label={`${m}m`}
                    tone="sky"
                    selected={s.focus.breakMinutes === m}
                    onPress={() => update({ focus: { ...s.focus, breakMinutes: m } })}
                  />
                ))}
              </ChoiceRow>
            </Card>
          </Section>
          <Section title="Advanced views">
            <Card className="gap-1">
              <ToggleRow
                label="Eisenhower matrix"
                value={s.advancedViews.eisenhower}
                onChange={(on) => update({ advancedViews: { ...s.advancedViews, eisenhower: on } })}
              />
              <ToggleRow
                label="Energy tags"
                value={s.advancedViews.energy}
                onChange={(on) => update({ advancedViews: { ...s.advancedViews, energy: on } })}
              />
              <ToggleRow
                label="Shopping list"
                value={s.advancedViews.shoppingList}
                onChange={(on) =>
                  update({ advancedViews: { ...s.advancedViews, shoppingList: on } })
                }
              />
            </Card>
          </Section>
        </>
      )}
    </SettingsPage>
  );
}
