import { useNotificationRouting } from "@/features/notifications/use-notification-routing";
import { useNotificationScheduler } from "@/features/notifications/use-notification-scheduler";
import { useWidgetSync } from "@/features/widget/use-widget-sync";
import { useReference } from "@/lib/queries";
import { useAppShortcuts } from "./use-app-shortcuts";

/** Background duties while signed in: notifications, widget and shortcuts. */
export function AppServices() {
  // Load the lists quick-add needs now, so logging works offline from the start.
  useReference();
  useNotificationRouting();
  useNotificationScheduler();
  useWidgetSync();
  useAppShortcuts();
  return null;
}
