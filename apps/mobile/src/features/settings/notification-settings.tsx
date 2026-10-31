import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { PickerField } from "@/components/ui/picker-field";
import { clockLabel, clockOptions } from "@/components/ui/picker-options";
import { Section } from "@/components/ui/section";
import { ToggleRow } from "@/components/ui/toggle-row";
import { whyShutdown, whyWeeklyReview } from "@/features/notifications/reminder-why";
import { setFeedbackPrefs, useFeedbackPrefs } from "@/lib/feedback-prefs";
import { askForNotifications } from "@/lib/notifications";
import { LONG_DAYS } from "./planning-settings";
import { ReminderStatusBanner } from "./reminder-status-banner";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

/** Quiet hours, the shutdown and weekly review reminders, and sounds and vibration. */
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
                options={clockOptions(["21:00", "22:00", "23:00", "00:00"])}
                describe={clockLabel}
                onChange={(t) =>
                  update({ quietHours: { ...s.quietHours, start: t ?? s.quietHours.start } })
                }
              />
              <PickerField
                label="Quiet hours end"
                value={s.quietHours.end}
                options={clockOptions(["06:00", "07:00", "08:00"])}
                describe={clockLabel}
                onChange={(t) =>
                  update({ quietHours: { ...s.quietHours, end: t ?? s.quietHours.end } })
                }
              />
              <PickerField
                label="Daily shutdown"
                value={s.shutdownTime}
                options={clockOptions(["20:30", "21:30", "22:30"])}
                describe={clockLabel}
                onChange={(t) => {
                  const time = t ?? s.shutdownTime;
                  update({ shutdownTime: time });
                  void askForNotifications(whyShutdown(time));
                }}
              />
              <View className="flex-row gap-3">
                <PickerField
                  label="Weekly review"
                  span="half"
                  value={String(s.weeklyReviewDay)}
                  options={LONG_DAYS.map((day, i) => ({ id: String(i), label: day }))}
                  describe={(d) => LONG_DAYS[Number(d)] ?? d}
                  onChange={(d) => {
                    const day = d === null ? s.weeklyReviewDay : Number(d);
                    update({ weeklyReviewDay: day });
                    void askForNotifications(
                      whyWeeklyReview(LONG_DAYS[day] ?? "week", s.weeklyReviewTime),
                    );
                  }}
                />
                <PickerField
                  label="Review time"
                  span="half"
                  value={s.weeklyReviewTime}
                  options={clockOptions(["09:00", "17:00", "19:00", "21:00"])}
                  describe={clockLabel}
                  onChange={(t) => {
                    const time = t ?? s.weeklyReviewTime;
                    update({ weeklyReviewTime: time });
                    void askForNotifications(
                      whyWeeklyReview(LONG_DAYS[s.weeklyReviewDay] ?? "week", time),
                    );
                  }}
                />
              </View>
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
