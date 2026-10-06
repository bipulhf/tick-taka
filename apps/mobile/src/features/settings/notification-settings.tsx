import { Card } from "@/components/ui/card";
import { PickerField } from "@/components/ui/picker-field";
import { Section } from "@/components/ui/section";
import { setFeedbackPrefs, useFeedbackPrefs } from "@/lib/feedback-prefs";
import { ReminderStatusBanner } from "./reminder-status-banner";
import { ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

const times = (...list: string[]) => list.map((t) => ({ id: t, label: t }));

/** Quiet hours, the shutdown reminder, and sounds and vibration. */
export function NotificationSettings() {
  const feedback = useFeedbackPrefs();
  const update = useUpdateSettings();
  return (
    <SettingsPage title="Notifications and sounds">
      {(s) => (
        <>
          <ReminderStatusBanner />
          <Section title="Notifications">
            <Card className="gap-3">
              <PickerField
                label="Quiet hours start"
                value={s.quietHours.start}
                options={times("21:00", "22:00", "23:00", "00:00")}
                onChange={(t) =>
                  update({ quietHours: { ...s.quietHours, start: t ?? s.quietHours.start } })
                }
              />
              <PickerField
                label="Quiet hours end"
                value={s.quietHours.end}
                options={times("06:00", "07:00", "08:00")}
                onChange={(t) =>
                  update({ quietHours: { ...s.quietHours, end: t ?? s.quietHours.end } })
                }
              />
              <PickerField
                label="Daily shutdown"
                value={s.shutdownTime}
                options={times("20:30", "21:30", "22:30")}
                onChange={(t) => update({ shutdownTime: t ?? s.shutdownTime })}
              />
            </Card>
          </Section>
          <Section title="Sounds and vibration">
            <Card className="gap-1">
              <ToggleRow
                label="Sounds"
                hint="A soft chime when you finish something; quiet when the phone is on silent"
                value={feedback.sounds}
                onChange={(on) => setFeedbackPrefs({ sounds: on })}
              />
              <ToggleRow
                label="Vibration"
                hint="A tap you can feel for checks, saves and wins"
                value={feedback.haptics}
                onChange={(on) => setFeedbackPrefs({ haptics: on })}
              />
            </Card>
          </Section>
        </>
      )}
    </SettingsPage>
  );
}
