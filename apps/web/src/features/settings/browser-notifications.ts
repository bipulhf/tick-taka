import { addDays, toLocalDate, weekdayOf, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { createStore, useStore } from "@/lib/store";

/**
 * Browser notifications, a choice of this browser (like sounds): they only show while
 * a Tick & Taka tab is open, so nothing here pretends to ring with every tab closed.
 */
export type ReminderKind = "focus" | "shutdown" | "weeklyReview";

export interface BrowserNotificationPrefs {
  enabled: boolean;
  kinds: Record<ReminderKind, boolean>;
}

export const REMINDER_KINDS: { kind: ReminderKind; label: string; description: string }[] = [
  { kind: "focus", label: "Focus bell", description: "When a focus session or a break ends" },
  { kind: "shutdown", label: "Daily shutdown", description: "Two minutes to close the day" },
  {
    kind: "weeklyReview",
    label: "Weekly review",
    description: "Five minutes to look back and pick next week's focus",
  },
];

const KEY = "tt.browser-notifications";
const DEFAULTS: BrowserNotificationPrefs = {
  enabled: false,
  kinds: { focus: true, shutdown: true, weeklyReview: true },
};

/** Stored prefs, with anything missing or unreadable taken from the defaults. */
export function parsePrefs(raw: string | null): BrowserNotificationPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<BrowserNotificationPrefs>;
    return {
      enabled: parsed.enabled === true,
      kinds: { ...DEFAULTS.kinds, ...(parsed.kinds ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): BrowserNotificationPrefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

export const browserNotificationStore = createStore<BrowserNotificationPrefs>(read());

function save(next: BrowserNotificationPrefs) {
  browserNotificationStore.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export const useBrowserNotifications = () => useStore(browserNotificationStore);

export function setReminderKind(kind: ReminderKind, on: boolean) {
  const current = browserNotificationStore.get();
  save({ ...current, kinds: { ...current.kinds, [kind]: on } });
}

export type Permission = NotificationPermission | "unsupported";

export function notificationPermission(): Permission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/**
 * Turns browser notifications on (asking the browser first) or off. Resolves to what
 * the browser said, so the caller can explain a refusal.
 */
export async function setBrowserNotifications(on: boolean): Promise<Permission> {
  const current = browserNotificationStore.get();
  if (!on) {
    save({ ...current, enabled: false });
    return notificationPermission();
  }
  if (typeof Notification === "undefined") return "unsupported";
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission === "granted") save({ ...current, enabled: true });
  return permission;
}

/** Whether a reminder can show now: switched on in this browser and allowed by it. */
export function browserNotificationsOn(): boolean {
  return browserNotificationStore.get().enabled && notificationPermission() === "granted";
}

/**
 * Shows one notification if they're on. `tag` names the reminder, so a second one
 * with the same tag replaces it rather than stacking. A click brings the tab forward.
 */
export function showReminder(tag: string, title: string, body: string, onClick?: () => void) {
  if (!browserNotificationsOn()) return;
  try {
    const notification = new Notification(title, { body, tag, icon: `${import.meta.env.BASE_URL}icon.png` });
    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; nothing to do then.
  }
}

/** Shows one notification if this kind is switched on and the browser allows it. */
export function showBrowserNotification(
  kind: ReminderKind,
  title: string,
  body: string,
  onClick?: () => void,
): void {
  if (!browserNotificationStore.get().kinds[kind]) return;
  showReminder(`tt-${kind}`, title, body, onClick);
}

function joinInstant(date: string, time: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ year, month, day, hour, minute }, timeZone);
}

/** The next moment a daily "HH:MM" comes round in `timeZone`, after `now`. */
export function nextDaily(time: string, now: number, timeZone: string): number {
  const today = toLocalDate(now, timeZone);
  const at = joinInstant(today, time, timeZone);
  return at > now ? at : joinInstant(addDays(today, 1), time, timeZone);
}

/** The next `weekday` (0 = Sunday) at "HH:MM" in `timeZone`, after `now`. */
export function nextWeekly(weekday: number, time: string, now: number, timeZone: string): number {
  const today = toLocalDate(now, timeZone);
  for (let i = 0; i <= 7; i++) {
    const date = addDays(today, i);
    if (weekdayOf(date) !== weekday) continue;
    const at = joinInstant(date, time, timeZone);
    if (at > now) return at;
  }
  return joinInstant(addDays(today, 7), time, timeZone);
}
