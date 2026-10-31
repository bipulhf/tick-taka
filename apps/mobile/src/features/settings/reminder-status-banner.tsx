import { useEffect } from "react";
import { AppState } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  notificationAccess,
  refreshNotificationAccess,
  reminderSyncError,
  turnOnNotifications,
} from "@/lib/notifications";
import { useStore } from "@/lib/store";

/**
 * One line when reminders can't ring: notifications refused or not allowed yet (with
 * a way to turn them on: Android's prompt while it still shows one, else the phone's
 * Settings), or the last refresh of the schedule failed. Hidden when all is well.
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

  if (access === "denied" || access === "unasked")
    return (
      <Card className="gap-3">
        <Text>
          {access === "denied"
            ? "Notifications are off, so reminders and bill alerts can't ring."
            : "Allow notifications so reminders and bill alerts can ring."}
        </Text>
        <Button
          label="Turn on notifications"
          icon="bell-outline"
          variant="secondary"
          size="sm"
          onPress={() => void turnOnNotifications().catch(() => {})}
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
