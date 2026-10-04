import AsyncStorage from "@react-native-async-storage/async-storage";
import { endOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { api, unwrap } from "@/lib/api";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useSettings, useToday } from "@/lib/queries";
import { planNotifications } from "./plan-notifications";

const PREFIX = "tt-";
const PACE_KEY = "tt.pace-alerts";

async function reschedule(settings: NonNullable<ReturnType<typeof useSettings>["data"]>) {
  if (!(await ensureNotificationPermission())) return;
  const now = Date.now();
  const [tasks, recurring, habits, debts] = await Promise.all([
    unwrap(
      api.tasks.$get({
        query: {
          status: "inbox,open",
          from: String(now - 86_400_000),
          to: String(
            endOfLocalDay(toLocalDate(now + 8 * 86_400_000, settings.timeZone), settings.timeZone),
          ),
        },
      }),
    ),
    unwrap(api.recurring.$get()),
    unwrap(api.habits.$get({ query: {} })),
    unwrap(api.debts.$get()),
  ]);
  const planned = planNotifications({
    now,
    timeZone: settings.timeZone,
    quietHours: settings.quietHours,
    tasks,
    recurring,
    habits,
    debts,
  });
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
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
    identifier: `${PREFIX}shutdown`,
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
    identifier: `${PREFIX}weekly-review`,
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
}

/** Re-schedules local notifications whenever fresh data arrives; no push service needed. */
export function useNotificationScheduler() {
  const { data: settings } = useSettings();
  const today = useToday();

  useEffect(() => {
    if (!settings || !today.dataUpdatedAt) return;
    const timer = setTimeout(() => void reschedule(settings).catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [settings, today.dataUpdatedAt]);

  // Pace alert: one calm heads-up per category per month, never a stream.
  const pace = today.data?.paceAlert;
  useEffect(() => {
    if (!pace || !today.data) return;
    const key = `${today.data.date.slice(0, 7)}:${pace.categoryId}`;
    void (async () => {
      const sent = JSON.parse((await AsyncStorage.getItem(PACE_KEY)) ?? "[]") as string[];
      if (sent.includes(key)) return;
      await AsyncStorage.setItem(PACE_KEY, JSON.stringify([...sent.slice(-50), key]));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${pace.emoji} ${pace.name} is running ahead`,
          body: "A small heads-up from Tiki. Plenty of month left to even it out.",
          data: { url: "/money/budgets" },
        },
        trigger: null,
      });
    })();
  }, [pace, today.data]);
}
