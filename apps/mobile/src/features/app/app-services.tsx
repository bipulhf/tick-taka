import { useNotificationRouting } from "@/features/notifications/use-notification-routing";
import { useNotificationScheduler } from "@/features/notifications/use-notification-scheduler";
import { useSmsCapture } from "@/features/sms/use-sms-capture";
import { useWidgetSync } from "@/features/widget/use-widget-sync";
import { useAppShortcuts } from "./use-app-shortcuts";

/** Background duties while signed in: notifications, SMS capture, widget and shortcuts. */
export function AppServices() {
  useNotificationRouting();
  useNotificationScheduler();
  useSmsCapture();
  useWidgetSync();
  useAppShortcuts();
  return null;
}
