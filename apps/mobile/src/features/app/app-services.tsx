import { useNotificationRouting } from "@/features/notifications/use-notification-routing";
import { useNotificationScheduler } from "@/features/notifications/use-notification-scheduler";
import { useWidgetSync } from "@/features/widget/use-widget-sync";
import { useReference } from "@/lib/queries";
import { useChangeSync } from "@/lib/sync-changes";
import { useAppShortcuts } from "./use-app-shortcuts";

/** Background duties while signed in: notifications, widget, shortcuts and sync. */
export function AppServices() {
  // Load the lists quick-add needs now, so logging works offline from the start.
  useReference();
  useNotificationRouting();
  useNotificationScheduler();
  useWidgetSync();
  useAppShortcuts();
  // Changes made elsewhere (assistant, widget, another device) refresh only what they touch.
  useChangeSync();
  return null;
}
