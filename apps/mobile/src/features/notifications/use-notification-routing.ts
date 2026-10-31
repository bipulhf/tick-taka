import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Tapping a notification opens the right screen. */
export function useNotificationRouting() {
  const router = useRouter();
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { url?: string } | undefined;
      const url = data?.url;
      if (url) router.push(url as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);
}
