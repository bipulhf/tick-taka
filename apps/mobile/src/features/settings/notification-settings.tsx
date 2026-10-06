import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Section } from "@/components/ui/section";
import { setFeedbackPrefs, useFeedbackPrefs } from "@/lib/feedback-prefs";
import { ChoiceRow, ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

/** Quiet hours, the shutdown reminder, and sounds and vibration. */
export function NotificationSettings() {
  const feedback = useFeedbackPrefs();
  const update = useUpdateSettings();
  return (
    <SettingsPage title="Notifications and sounds">
      {(s) => (
        <>
          <Section title="Notifications">
            <Card className="gap-1">
              <ChoiceRow label="Quiet hours start">
                {["21:00", "22:00", "23:00", "00:00"].map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={s.quietHours.start === t}
                    onPress={() => update({ quietHours: { ...s.quietHours, start: t } })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow label="Quiet hours end">
                {["06:00", "07:00", "08:00"].map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={s.quietHours.end === t}
                    onPress={() => update({ quietHours: { ...s.quietHours, end: t } })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow label="Daily shutdown">
                {["20:30", "21:30", "22:30"].map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={s.shutdownTime === t}
                    onPress={() => update({ shutdownTime: t })}
                  />
                ))}
              </ChoiceRow>
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
