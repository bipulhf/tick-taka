import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { api, unwrap } from "@/lib/api";
import { usePrivacy } from "@/lib/prefs";
import { fetchToday, keys, useSettings } from "@/lib/queries";
import { createStore } from "@/lib/store";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { showReminder } from "./browser-notifications";
import { claimReminder } from "./reminder-claim";
import {
  dueReminders,
  nextCheckIn,
  type PlannedReminder,
  paceReminder,
  planReminders,
  type ReminderTarget,
  reminderQuery,
} from "./reminder-plan";

/** Why the last reminder refresh failed, if it did; shown quietly in Settings. */
export const reminderSyncError = createStore<string | null>(null);

/** Reminders set on another device show up within this long, tab focus aside. */
const REFRESH_MS = 30 * 60_000;
/** How long the shared ledger remembers a rung reminder, and a sent pace alert. */
export const RANG_KEEP_MS = 2 * 86_400_000;
const PACE_KEEP_MS = 40 * 86_400_000;

/**
 * Task reminders, bills and income, habit nudges, debt reminders and the pace alert,
 * as browser notifications while a tab is open (the phone schedules the same ones).
 * Every tab plans them; the shared ledger lets one tab ring each. A click opens the
 * thing it is about.
 */
export function usePlannedReminders(on: boolean) {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const zone = userTime(settings).timeZone;
  const quiet = settings?.quietHours;
  const today = useTodayDate();
  // Hide amounts: bills and income ring without their figure.
  const hidden = usePrivacy();

  // The views' own query keys, so a write that changes them refreshes the plan too.
  const tasks = useQuery({
    queryKey: ["tasks", "reminders"],
    // By when the reminder rings, not the day the task is planned for.
    queryFn: () => unwrap(api.tasks.$get({ query: reminderQuery(Date.now()) })),
    enabled: on,
    refetchInterval: on ? REFRESH_MS : false,
  });
  const recurring = useQuery({
    queryKey: ["recurring"],
    queryFn: () => unwrap(api.recurring.$get()),
    enabled: on,
  });
  const habits = useQuery({
    queryKey: ["habits", today, "active"],
    queryFn: () => unwrap(api.habits.$get({ query: { date: today } })),
    enabled: on,
  });
  const debts = useQuery({
    queryKey: ["debts"],
    queryFn: () => unwrap(api.debts.$get()),
    enabled: on,
  });
  const todayData = useQuery({
    queryKey: keys.today(today),
    queryFn: () => fetchToday(),
    enabled: on,
  });

  const failure = [tasks, recurring, habits, debts].find((q) => q.error)?.error;
  useEffect(() => {
    reminderSyncError.set(
      on && failure ? (failure instanceof Error ? failure.message : String(failure)) : null,
    );
  }, [on, failure]);

  const open = useCallback(
    (target: ReminderTarget) =>
      void navigate({
        to: target.to as never,
        search: (target.panel ? { panel: target.panel } : {}) as never,
      }),
    [navigate],
  );

  // Rings what came due after this moment; reset on switching on, so nothing old rings.
  const since = useRef(Date.now());
  useEffect(() => {
    if (on) since.current = Date.now();
  }, [on]);

  useEffect(() => {
    if (!on || !quiet) return;
    const inputs = {
      timeZone: zone,
      quietHours: quiet,
      hidden,
      tasks: tasks.data ?? [],
      recurring: recurring.data ?? [],
      habits: habits.data ?? [],
      debts: debts.data ?? [],
    };
    const ring = async (n: PlannedReminder) => {
      if (await claimReminder(`${n.id}@${n.at}`, n.at + RANG_KEEP_MS))
        showReminder(n.id, n.title, n.body, () => open(n.target));
    };
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const now = Date.now();
      const plan = planReminders({ ...inputs, now: since.current });
      for (const n of dueReminders(plan, since.current, now)) void ring(n);
      since.current = Math.max(since.current, now);
      timer = setTimeout(check, nextCheckIn(plan, now));
    };
    check();
    return () => clearTimeout(timer);
  }, [on, quiet, zone, hidden, tasks.data, recurring.data, habits.data, debts.data, open]);

  // Pace alert: one calm heads-up per category per month, never a stream.
  const pace = todayData.data?.paceAlert;
  const paceDate = todayData.data?.date;
  useEffect(() => {
    if (!on || !quiet || paceDate !== today) return;
    const alert = paceReminder(pace, today, Date.now(), quiet, zone);
    if (!alert) return;
    void (async () => {
      if (await claimReminder(alert.key, Date.now() + PACE_KEEP_MS))
        showReminder(alert.key, alert.title, alert.body, () => open(alert.target));
    })();
  }, [on, quiet, zone, pace, paceDate, today, open]);
}
