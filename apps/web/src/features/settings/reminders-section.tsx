import { useEffect, useState } from "react";
import { Group } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
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
import { clockOptions, GroupLabel, LONG_DAYS, SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";
import { reminderSyncError } from "./use-planned-reminders";

const REFUSED =
  "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.";

/** Browser notifications while a tab is open, the daily shutdown, the weekly review, quiet hours. */
export function NotificationsSection({ s, update }: SectionProps) {
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
    <Section id="settings-notifications" title="Notifications">
      <Group>
        <ToggleRow
          label="Browser notifications"
          description={
            unsupported
              ? "This browser can't show notifications."
              : permission === "denied"
                ? "Blocked for this site. Allow them in the browser's site settings."
                : "Reminders pop up while Tick & Taka is open in a tab"
          }
          checked={on}
          disabled={unsupported}
          onChange={(next) => void toggle(next)}
        />
        {REMINDER_KINDS.map((kind) => (
          <ToggleRow
            key={kind.kind}
            label={kind.label}
            description={kind.description}
            checked={on && prefs.kinds[kind.kind]}
            disabled={!on}
            onChange={(next) => setReminderKind(kind.kind, next)}
          />
        ))}
      </Group>
      <p className="px-1 text-callout text-muted">
        Task reminders, bills, habit nudges and loan reminders ring here too, after quiet hours.
        Nothing rings with every Tick & Taka tab closed. The Android app keeps its own reminders.
      </p>
      {on && syncError ? (
        <p className="px-1 text-caption text-muted" aria-live="polite">
          Reminders couldn't be refreshed last time. They try again when you come back to this tab.
        </p>
      ) : null}

      <GroupLabel>When</GroupLabel>
      <Group>
        <SelectRow
          label="Daily shutdown"
          value={s.shutdownTime}
          options={clockOptions(["20:30", "21:30", "22:30"])}
          onChange={(shutdownTime) => update({ shutdownTime })}
        />
        <SelectRow
          label="Weekly review"
          value={String(s.weeklyReviewDay)}
          options={LONG_DAYS.map((day, i) => ({ value: String(i), label: day }))}
          onChange={(d) => update({ weeklyReviewDay: Number(d) })}
        />
        <SelectRow
          label="Weekly review time"
          value={s.weeklyReviewTime}
          options={clockOptions(["09:00", "17:00", "19:00", "21:00"])}
          onChange={(weeklyReviewTime) => update({ weeklyReviewTime })}
        />
        <SelectRow
          label="Quiet hours start"
          value={s.quietHours.start}
          options={clockOptions(["21:00", "22:00", "23:00", "00:00"])}
          onChange={(start) => update({ quietHours: { ...s.quietHours, start } })}
        />
        <SelectRow
          label="Quiet hours end"
          value={s.quietHours.end}
          options={clockOptions(["06:00", "07:00", "08:00"])}
          onChange={(end) => update({ quietHours: { ...s.quietHours, end } })}
        />
      </Group>
    </Section>
  );
}
