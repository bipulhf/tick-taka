import * as Notifications from "expo-notifications";
import { api, unwrap } from "@/lib/api";
import { planNotifications, staleReminderIds } from "./plan-notifications";
import { reminderQuery } from "./reminder-window";

const PREFIX = "tt-";
const SHUTDOWN_ID = `${PREFIX}shutdown`;
const WEEKLY_REVIEW_ID = `${PREFIX}weekly-review`;

type SettingsReply = Awaited<ReturnType<typeof fetchSettings>>;

/** What reminders need from Settings. */
export type ReminderSettings = Pick<
  SettingsReply,
  "timeZone" | "quietHours" | "shutdownTime" | "weeklyReviewDay" | "weeklyReviewTime"
>;

/** Request options for a caller without the app's session, such as the background task. */
type RequestOptions = { headers: Record<string, string> } | undefined;

export function fetchSettings(options?: RequestOptions) {
  return unwrap(api.settings.$get(undefined, options));
}

/**
 * Fetches what reminders are made of and schedules them on the phone (see
 * planNotifications), plus the repeating shutdown and weekly review. New ones replace
 * old ones with the same id first and only then is the rest cancelled, so a failure
 * part-way (offline, a refused request) leaves the reminders already set ringing.
 * Used by the app and by the background refresh; it never asks for permission.
 */
export async function scheduleReminders(
  settings: ReminderSettings,
  hidden: boolean,
  options?: RequestOptions,
): Promise<void> {
  const now = Date.now();
  const [tasks, recurring, habits, debts] = await Promise.all([
    // By when the reminder rings, not the day the task is planned for.
    unwrap(api.tasks.$get({ query: reminderQuery(now) }, options)),
    unwrap(api.recurring.$get(undefined, options)),
    unwrap(api.habits.$get({ query: {} }, options)),
    unwrap(api.debts.$get(undefined, options)),
  ]);
  const planned = planNotifications({
    now,
    timeZone: settings.timeZone,
    quietHours: settings.quietHours,
    hidden,
    tasks,
    recurring,
    habits,
    debts,
  });
  for (const n of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.at) },
    });
  }
  const [shutdownHour, shutdownMinute] = settings.shutdownTime.split(":").map(Number) as [
    number,
    number,
  ];
  await Notifications.scheduleNotificationAsync({
    identifier: SHUTDOWN_ID,
    content: {
      title: "Daily shutdown 🌙",
      body: "Two minutes to close the day.",
      data: { url: "/review/shutdown" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: shutdownHour,
      minute: shutdownMinute,
    },
  });
  const [reviewHour, reviewMinute] = settings.weeklyReviewTime.split(":").map(Number) as [
    number,
    number,
  ];
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_REVIEW_ID,
    content: {
      title: "Weekly review",
      body: "Five minutes to look back and pick next week's focus.",
      data: { url: "/review/weekly" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: settings.weeklyReviewDay + 1,
      hour: reviewHour,
      minute: reviewMinute,
    },
  });
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const stale = staleReminderIds(
    scheduled.map((n) => n.identifier),
    [...planned.map((n) => n.id), SHUTDOWN_ID, WEEKLY_REVIEW_ID],
    PREFIX,
  );
  await Promise.all(stale.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
