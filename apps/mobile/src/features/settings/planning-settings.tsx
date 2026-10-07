import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PickerField } from "@/components/ui/picker-field";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { ToggleRow } from "@/components/ui/toggle-row";
import { formatMinutes, plural } from "@/lib/format";
import { ChoiceRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { phoneTimeZone, timeZoneLabel, timeZoneOptions } from "./time-zones";
import { useUpdateSettings } from "./use-update-settings";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Tiki and the server accept values outside the presets; these label them too.
const goalLabel = (n: number) => (n === 0 ? "Off" : plural(n, "task"));
const minutesLabel = (m: string) => plural(Number(m), "minute");

/** The daily goal, days off, time zone, focus timer lengths and the optional planning views. */
export function PlanningSettings() {
  const update = useUpdateSettings();
  const phone = phoneTimeZone();
  const now = Date.now();
  return (
    <SettingsPage title="Today and planning">
      {(s) => (
        <>
          <Section title="Today">
            <Card className="gap-3">
              <PickerField
                label="Daily task goal"
                value={String(s.dailyTaskGoal)}
                options={[0, 3, 5, 7, 10].map((n) => ({ id: String(n), label: goalLabel(n) }))}
                describe={(n) => goalLabel(Number(n))}
                onChange={(n) => update({ dailyTaskGoal: Number(n) })}
              />
              {/* Several can be picked, so these stay chips (checkboxes), not a picker. */}
              <ChoiceRow label="Days off" choice="multi">
                {DAYS.map((day, i) => (
                  <Chip
                    key={day}
                    label={day}
                    choice="multi"
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
              <PickerField
                label="Free time on a working day"
                value={String(s.dayCapacityMinutes)}
                options={[240, 360, 480, 600].map((m) => ({
                  id: String(m),
                  label: formatMinutes(m),
                }))}
                describe={(m) => formatMinutes(Number(m))}
                onChange={(m) => update({ dayCapacityMinutes: Number(m) })}
              />
              <PickerField
                label="Week starts on"
                value={String(s.weekStartsOn)}
                options={[6, 0, 1].map((d) => ({ id: String(d), label: LONG_DAYS[d] ?? "" }))}
                describe={(d) => LONG_DAYS[Number(d)] ?? d}
                onChange={(d) => update({ weekStartsOn: Number(d) })}
              />
              <PickerField
                label="Time zone"
                value={s.timeZone}
                options={timeZoneOptions(phone, now)}
                describe={(zone) => timeZoneLabel(zone, now)}
                onChange={(zone) => (zone ? update({ timeZone: zone }) : undefined)}
              />
              {phone && phone !== s.timeZone ? (
                <View className="gap-2">
                  <Text variant="caption" tone="muted">
                    {`Your phone is on ${timeZoneLabel(phone, now)}. Today, reminders and budget days follow the time zone above.`}
                  </Text>
                  <Button
                    label="Use this phone's zone"
                    size="sm"
                    variant="secondary"
                    onPress={() => update({ timeZone: phone })}
                  />
                </View>
              ) : null}
            </Card>
          </Section>
          <Section title="Focus">
            <Card className="gap-3">
              <PickerField
                label="Work"
                value={String(s.focus.workMinutes)}
                options={[15, 25, 45, 50, 90].map((m) => ({
                  id: String(m),
                  label: plural(m, "minute"),
                }))}
                describe={minutesLabel}
                onChange={(m) => update({ focus: { ...s.focus, workMinutes: Number(m) } })}
              />
              <PickerField
                label="Break"
                value={String(s.focus.breakMinutes)}
                options={[5, 10, 15].map((m) => ({ id: String(m), label: plural(m, "minute") }))}
                describe={minutesLabel}
                onChange={(m) => update({ focus: { ...s.focus, breakMinutes: Number(m) } })}
              />
            </Card>
          </Section>
          <Section title="Advanced views">
            <Card className="gap-3">
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
