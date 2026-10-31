import { useEffect, useState } from "react";
import { Group } from "@/components/ui/group";
import { ToggleRow } from "@/components/ui/toggle";
import { useStore } from "@/lib/store";
import { notify } from "@/lib/toast";
import {
  notificationPermission,
  REMINDER_KINDS,
  setBrowserNotifications,
  setReminderKind,
  useBrowserNotifications,
} from "./browser-notifications";
import { clockOptions, GroupLabel, LONG_DAYS, PairRow, SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";
import { reminderSyncError } from "./use-planned-reminders";

const REFUSED =
  "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.";

/**
 * Browser notifications first (each kind shows once they're on), then the schedule the
 * reminders and reviews follow: the daily shutdown, the weekly review, quiet hours.
 */
export function RemindersSection({ s, update }: SectionProps) {
  const prefs = useBrowserNotifications();
  const syncError = useStore(reminderSyncError);
  const [permission, setPermission] = useState(notificationPermission);
  // Coming back from the browser's site settings should show the change at once.
  useEffect(() => {
    const check = () => setPermission(notificationPermission());
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);
  const unsupported = permission === "unsupported";
  const on = prefs.enabled && permission === "granted";

  const toggle = async (next: boolean) => {
    const answer = await setBrowserNotifications(next);
    setPermission(answer);
    if (next && answer === "denied") notify(REFUSED);
  };

  return (
    <>
      <Group>
        <ToggleRow
          label="Browser notifications"
          description={
            unsupported
              ? "This browser can't show notifications."
              : permission === "denied"
                ? "Blocked for this site. Allow them in the browser's site settings."
                : "Tasks, bills, habits and reviews pop up while the app is open in a tab"
          }
          checked={on}
          disabled={unsupported}
          onChange={(next) => void toggle(next)}
        />
        {on
          ? REMINDER_KINDS.map((kind) => (
              <ToggleRow
                key={kind.kind}
                label={kind.label}
                description={kind.description}
                checked={prefs.kinds[kind.kind]}
                onChange={(next) => setReminderKind(kind.kind, next)}
              />
            ))
          : null}
      </Group>
      {on && syncError ? (
        <p className="px-1 text-caption text-muted" aria-live="polite">
          Reminders couldn't be refreshed last time. They try again when you come back to this tab.
        </p>
      ) : (
        <p className="px-1 text-callout text-muted">
          Nothing rings with every tab closed. The Android app keeps its own reminders.
        </p>
      )}

      <GroupLabel>Schedule</GroupLabel>
      <Group>
        <SelectRow
          label="Daily shutdown"
          description="When the evening wrap-up comes round"
          value={s.shutdownTime}
          options={clockOptions(["20:30", "21:30", "22:30"])}
          onChange={(shutdownTime) => update({ shutdownTime })}
        />
        <PairRow
          label="Weekly review"
          first={{
            label: "Weekly review day",
            value: String(s.weeklyReviewDay),
            options: LONG_DAYS.map((day, i) => ({ value: String(i), label: day })),
            onChange: (d) => update({ weeklyReviewDay: Number(d) }),
          }}
          joiner="at"
          second={{
            label: "Weekly review time",
            value: s.weeklyReviewTime,
            options: clockOptions(["09:00", "17:00", "19:00", "21:00"]),
            onChange: (weeklyReviewTime) => update({ weeklyReviewTime }),
          }}
        />
        <PairRow
          label="Quiet hours"
          description="Nothing rings in between"
          first={{
            label: "Quiet hours start",
            value: s.quietHours.start,
            options: clockOptions(["21:00", "22:00", "23:00", "00:00"]),
            onChange: (start) => update({ quietHours: { ...s.quietHours, start } }),
          }}
          joiner="to"
          second={{
            label: "Quiet hours end",
            value: s.quietHours.end,
            options: clockOptions(["06:00", "07:00", "08:00"]),
            onChange: (end) => update({ quietHours: { ...s.quietHours, end } }),
          }}
        />
      </Group>
    </>
  );
}
