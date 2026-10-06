import { useEffect } from "react";
import { AppState, Linking } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  notificationAccess,
  refreshNotificationAccess,
  reminderSyncError,
} from "@/lib/notifications";
import { useStore } from "@/lib/store";

/**
 * One line when reminders can't ring: notifications switched off for the app
 * (with a way to the phone's Settings), or the last refresh of the schedule
 * failed. Hidden when all is well.
 */
export function ReminderStatusBanner() {
  const access = useStore(notificationAccess);
  const error = useStore(reminderSyncError);
  useEffect(() => {
    void refreshNotificationAccess().catch(() => {});
    // Coming back from the phone's Settings should clear the banner at once.
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void refreshNotificationAccess().catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  if (access === "denied")
    return (
      <Card className="gap-3">
        <Text>Notifications are off, so reminders and bill alerts can't ring.</Text>
        <Button
          label="Open settings"
          icon="cog-outline"
          variant="secondary"
          size="sm"
          onPress={() => void Linking.openSettings()}
          className="self-start"
        />
      </Card>
    );
  if (error)
    return (
      <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
        Reminders couldn't be refreshed last time. They try again when you open the app.
      </Text>
    );
  return null;
}
