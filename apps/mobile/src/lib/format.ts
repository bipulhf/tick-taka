import { DEFAULT_TIME_ZONE, localParts, toLocalDate } from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";

export { formatAmount };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatClock(ms: number, timeZone = DEFAULT_TIME_ZONE): string {
  const { hour, minute } = localParts(ms, timeZone);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** "Today", "Tomorrow", "Tue 6 Oct" — with a time when one is set. */
export function formatWhen(
  ms: number,
  hasTime: boolean,
  now = Date.now(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const date = toLocalDate(ms, timeZone);
  const today = toLocalDate(now, timeZone);
  const tomorrow = toLocalDate(now + 86_400_000, timeZone);
  const yesterday = toLocalDate(now - 86_400_000, timeZone);
  const p = localParts(ms, timeZone);
  const day =
    date === today
      ? "Today"
      : date === tomorrow
        ? "Tomorrow"
        : date === yesterday
          ? "Yesterday"
          : `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
  return hasTime ? `${day}, ${formatClock(ms, timeZone)}` : day;
}

export function formatLocalDate(date: string, style: "short" | "long" = "short"): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return style === "long"
    ? `${LONG_DAYS[weekday]}, ${d} ${MONTHS[m - 1]}`
    : `${DAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
