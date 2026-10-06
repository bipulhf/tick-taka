/**
 * Recurrence rules. Stored as a small subset of RFC 5545 RRULE text
 * (FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, BYHOUR, BYMINUTE) and computed on
 * local dates so "every month on the 5th" means the 5th in the user's time zone.
 */

import {
  addDays,
  daysInMonth,
  diffDays,
  type LocalDate,
  parseLocalDate,
  startOfWeek,
  toLocalDate,
  weekdayOf,
} from "./dates";
import { toAsciiDigits } from "./digits";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceRule {
  freq: Frequency;
  interval: number;
  /** 0 = Sunday … 6 = Saturday */
  byDay?: number[];
  /** 1…31, or -1 for the last day of the month */
  byMonthDay?: number[];
  /** 1…12 */
  byMonth?: number[];
  byHour?: number;
  byMinute?: number;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Bangladesh work week: Sunday to Thursday. */
export const DEFAULT_WORKDAYS = [0, 1, 2, 3, 4];

export function formatRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.map((d) => DAY_CODES[d]).join(",")}`);
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
  if (rule.byMonth?.length) parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
  if (rule.byHour !== undefined) parts.push(`BYHOUR=${rule.byHour}`);
  if (rule.byMinute !== undefined) parts.push(`BYMINUTE=${rule.byMinute}`);
  return parts.join(";");
}

export function parseRRule(text: string): RecurrenceRule {
  const fields = new Map<string, string>();
  for (const part of text.replace(/^RRULE:/i, "").split(";")) {
    const [key, value] = part.split("=");
    if (key && value !== undefined)
      fields.set(key.trim().toUpperCase(), value.trim().toUpperCase());
  }
  const freq = fields.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    throw new Error(`Unsupported or missing FREQ in "${text}"`);
  }
  const numbers = (key: string) =>
    fields
      .get(key)
      ?.split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n));
  const rule: RecurrenceRule = {
    freq,
    interval: Math.max(1, Number(fields.get("INTERVAL") ?? 1) || 1),
  };
  const byDay = fields
    .get("BYDAY")
    ?.split(",")
    .map((code) => DAY_CODES.indexOf(code.slice(-2) as (typeof DAY_CODES)[number]))
    .filter((d) => d >= 0);
  if (byDay?.length) rule.byDay = byDay;
  const byMonthDay = numbers("BYMONTHDAY");
  if (byMonthDay?.length) rule.byMonthDay = byMonthDay;
  const byMonth = numbers("BYMONTH");
  if (byMonth?.length) rule.byMonth = byMonth;
  const byHour = numbers("BYHOUR")?.[0];
  if (byHour !== undefined) rule.byHour = byHour;
  const byMinute = numbers("BYMINUTE")?.[0];
  if (byMinute !== undefined) rule.byMinute = byMinute;
  return rule;
}

const inRange = (values: number[] | undefined, min: number, max: number) =>
  values === undefined || values.every((v) => v >= min && v <= max);

/** Whether every BY* part is a real value: month day 1-31 or -1 (last), month 1-12, hour 0-23. */
export function hasValidRanges(rule: RecurrenceRule): boolean {
  return (
    (rule.byMonthDay === undefined ||
      rule.byMonthDay.every((d) => d === -1 || (d >= 1 && d <= 31))) &&
    inRange(rule.byMonth, 1, 12) &&
    inRange(rule.byHour === undefined ? undefined : [rule.byHour], 0, 23) &&
    inRange(rule.byMinute === undefined ? undefined : [rule.byMinute], 0, 59)
  );
}

/**
 * A rule is valid when it parses, its parts are in range and it actually occurs
 * after `today`, so "every month on the 0th" can't be saved and never come due.
 */
export function isValidRRule(text: string, today: LocalDate = toLocalDate(Date.now())): boolean {
  try {
    const rule = parseRRule(text);
    return hasValidRanges(rule) && nextOccurrence(rule, today) !== null;
  } catch {
    return false;
  }
}

function resolveMonthDay(monthDay: number, year: number, month: number): number {
  const dim = daysInMonth(`${year}-${String(month).padStart(2, "0")}`);
  return monthDay > 0 ? Math.min(monthDay, dim) : dim + monthDay + 1;
}

/** Whether `date` is an occurrence of `rule` for a series anchored at `anchor`. */
export function occursOn(rule: RecurrenceRule, date: LocalDate, anchor: LocalDate): boolean {
  if (date < anchor) return false;
  const d = parseLocalDate(date);
  const a = parseLocalDate(anchor);
  const interval = Math.max(1, rule.interval);
  switch (rule.freq) {
    case "DAILY": {
      if (rule.byDay && !rule.byDay.includes(weekdayOf(date))) return false;
      return diffDays(anchor, date) % interval === 0;
    }
    case "WEEKLY": {
      const days = rule.byDay?.length ? rule.byDay : [weekdayOf(anchor)];
      if (!days.includes(weekdayOf(date))) return false;
      const weeks = diffDays(startOfWeek(anchor, 1), startOfWeek(date, 1)) / 7;
      return weeks % interval === 0;
    }
    case "MONTHLY": {
      const months = (d.year - a.year) * 12 + (d.month - a.month);
      if (months % interval !== 0) return false;
      if (rule.byMonth && !rule.byMonth.includes(d.month)) return false;
      if (rule.byDay?.length && !rule.byMonthDay?.length)
        return rule.byDay.includes(weekdayOf(date));
      const monthDays = rule.byMonthDay?.length ? rule.byMonthDay : [a.day];
      return monthDays.some((md) => resolveMonthDay(md, d.year, d.month) === d.day);
    }
    case "YEARLY": {
      if ((d.year - a.year) % interval !== 0) return false;
      const months = rule.byMonth?.length ? rule.byMonth : [a.month];
      if (!months.includes(d.month)) return false;
      const monthDays = rule.byMonthDay?.length ? rule.byMonthDay : [a.day];
      return monthDays.some((md) => resolveMonthDay(md, d.year, d.month) === d.day);
    }
  }
}

const SEARCH_LIMIT_DAYS = 366 * 12;

/** First occurrence strictly after `after`. `anchor` is the series start (dtstart). */
export function nextOccurrence(
  rule: RecurrenceRule | string,
  anchor: LocalDate,
  after: LocalDate = anchor,
): LocalDate | null {
  const parsed = typeof rule === "string" ? parseRRule(rule) : rule;
  let candidate = addDays(after < anchor ? addDays(anchor, -1) : after, 1);
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++, candidate = addDays(candidate, 1)) {
    if (occursOn(parsed, candidate, anchor)) return candidate;
  }
  return null;
}

/**
 * First occurrence on or after `from`. The interval only applies between
 * occurrences, so the first matching day is the series start.
 */
export function firstOccurrence(rule: RecurrenceRule | string, from: LocalDate): LocalDate | null {
  const parsed = typeof rule === "string" ? parseRRule(rule) : rule;
  const everyPeriod = { ...parsed, interval: 1 };
  if (occursOn(everyPeriod, from, from)) return from;
  return nextOccurrence(everyPeriod, from, from);
}

// ---------------------------------------------------------------------------
// Plain-words parsing ("every other Tuesday", "every month on the 5th")
// ---------------------------------------------------------------------------

const WEEKDAY_WORDS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  sundays: 0,
  mon: 1,
  monday: 1,
  mondays: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  tuesdays: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  wednesdays: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  thursdays: 4,
  fri: 5,
  friday: 5,
  fridays: 5,
  sat: 6,
  saturday: 6,
  saturdays: 6,
};

const MONTH_WORDS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const WEEKDAY_ALT = Object.keys(WEEKDAY_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const MONTH_ALT = Object.keys(MONTH_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const ORDINAL = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const CLOCK = String.raw`(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`;

export interface ClockTime {
  hour: number;
  minute: number;
}

/** Parses "10am", "5 pm", "17:30", "7:05pm". */
export function parseClock(text: string): ClockTime | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (!meridiem && match[2] === undefined) return null; // bare "10" is not a time
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export interface ParsedRecurrence {
  rule: RecurrenceRule;
  rrule: string;
  /** The input with the recurrence phrase removed. */
  rest: string;
  /** The exact recurrence phrase that was matched. */
  phrase: string;
}

interface Pattern {
  regex: RegExp;
  build: (match: RegExpExecArray, workdays: number[]) => RecurrenceRule | null;
}

function weekdayList(text: string): number[] {
  const days = text
    .toLowerCase()
    .split(/\s*(?:,|\band\b|&|\/)\s*/)
    .map((word) => WEEKDAY_WORDS[word.trim()])
    .filter((d): d is number => d !== undefined);
  return [...new Set(days)].sort((a, b) => a - b);
}

const UNIT_FREQ: Record<string, Frequency> = {
  day: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
  year: "YEARLY",
};

const PATTERNS: Pattern[] = [
  {
    // every month on the 5th / monthly on the 5th / every 2 months on the last day
    regex: new RegExp(
      String.raw`\b(?:every\s+(?:(other|\d+)\s+)?months?|monthly)\s+on\s+the\s+(?:${ORDINAL}|(last)\s+day)\b`,
      "i",
    ),
    build: (m) => ({
      freq: "MONTHLY",
      interval: m[1] === "other" ? 2 : Number(m[1] ?? 1),
      byMonthDay: [m[3] ? -1 : Number(m[2])],
    }),
  },
  {
    // on the 5th of every month / the 5th of each month
    regex: new RegExp(
      String.raw`\b(?:on\s+)?the\s+${ORDINAL}\s+of\s+(?:every|each)\s+month\b`,
      "i",
    ),
    build: (m) => ({ freq: "MONTHLY", interval: 1, byMonthDay: [Number(m[1])] }),
  },
  {
    // every year on Oct 4 / yearly on 4 October
    regex: new RegExp(
      String.raw`\b(?:every\s+year|yearly|annually)\s+on\s+(?:(${MONTH_ALT})\s+${ORDINAL}|${ORDINAL}\s+(${MONTH_ALT}))\b`,
      "i",
    ),
    build: (m) => {
      const month = MONTH_WORDS[(m[1] ?? m[4] ?? "").toLowerCase()];
      const day = Number(m[2] ?? m[3]);
      return month ? { freq: "YEARLY", interval: 1, byMonth: [month], byMonthDay: [day] } : null;
    },
  },
  {
    // every weekday / weekdays
    regex: /\b(?:every\s+weekday|on\s+weekdays|weekdays)\b/i,
    build: (_m, workdays) => ({ freq: "WEEKLY", interval: 1, byDay: [...workdays] }),
  },
  {
    // every weekend
    regex: /\b(?:every\s+weekend|on\s+weekends|weekends)\b/i,
    build: (_m, workdays) => ({
      freq: "WEEKLY",
      interval: 1,
      byDay: [0, 1, 2, 3, 4, 5, 6].filter((d) => !workdays.includes(d)),
    }),
  },
  {
    // every other Tuesday / every 2 weeks on Sun and Tue / every Sun, Tue
    regex: new RegExp(
      String.raw`\bevery\s+(?:(other|\d+)\s+(?:weeks?\s+on\s+)?)?((?:${WEEKDAY_ALT})(?:\s*(?:,|and|&|/)\s*(?:${WEEKDAY_ALT}))*)\b`,
      "i",
    ),
    build: (m) => ({
      freq: "WEEKLY",
      interval: m[1] === "other" ? 2 : Number(m[1] ?? 1),
      byDay: weekdayList(m[2] ?? ""),
    }),
  },
  {
    // every 3 days / every other week / every month
    regex: /\bevery\s+(?:(other|\d+)\s+)?(day|week|month|year)s?\b/i,
    build: (m) => ({
      freq: UNIT_FREQ[(m[2] ?? "day").toLowerCase()] ?? "DAILY",
      interval: m[1] === "other" ? 2 : Number(m[1] ?? 1),
    }),
  },
  {
    regex: /\b(daily|everyday|weekly|monthly|yearly|annually)\b/i,
    build: (m) => {
      const word = (m[1] ?? "").toLowerCase();
      const freq: Frequency =
        word === "weekly"
          ? "WEEKLY"
          : word === "monthly"
            ? "MONTHLY"
            : word === "daily" || word === "everyday"
              ? "DAILY"
              : "YEARLY";
      return { freq, interval: 1 };
    },
  },
];

const CLOCK_AFTER = new RegExp(String.raw`^${CLOCK}\b`, "i");

/**
 * Finds a plain-words recurrence in `text`. Returns null when there is none.
 * A clock time right after the phrase ("every Sun and Tue 10am") sets BYHOUR/BYMINUTE.
 */
export function parseRecurrence(
  input: string,
  options: { workdays?: number[] } = {},
): ParsedRecurrence | null {
  // "every ৩ days": Bangla digits read as 0-9. `rest` and `phrase` come back in ASCII digits.
  const text = toAsciiDigits(input);
  const workdays = options.workdays ?? DEFAULT_WORKDAYS;
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const rule = pattern.build(match, workdays);
    if (!rule || rule.interval < 1 || !hasValidRanges(rule)) continue;
    if (rule.freq === "WEEKLY" && rule.byDay && rule.byDay.length === 0) continue;
    let end = match.index + match[0].length;
    const clockMatch = CLOCK_AFTER.exec(text.slice(end));
    if (clockMatch) {
      const clock = parseClock(
        `${clockMatch[1]}${clockMatch[2] ? `:${clockMatch[2]}` : ""}${clockMatch[3] ?? ""}`,
      );
      if (clock) {
        rule.byHour = clock.hour;
        rule.byMinute = clock.minute;
        end += clockMatch[0].length;
      }
    }
    const phrase = text.slice(match.index, end).trim();
    const rest = `${text.slice(0, match.index)} ${text.slice(end)}`.replace(/\s+/g, " ").trim();
    return { rule, rrule: formatRRule(rule), rest, phrase };
  }
  return null;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? "th"}`;
}

function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "am" : "pm"}`;
}

/** Human description, e.g. "Every other Tuesday" or "Every month on the 5th at 9 am". */
export function describeRRule(rrule: string): string {
  const rule = parseRRule(rrule);
  const every =
    rule.interval === 1 ? "Every" : rule.interval === 2 ? "Every other" : `Every ${rule.interval}`;
  const plural = rule.interval > 2 ? "s" : "";
  let text: string;
  switch (rule.freq) {
    case "DAILY":
      text = `${every} day${plural}`;
      break;
    case "WEEKLY": {
      const days = rule.byDay?.flatMap((d) => DAY_NAMES[d] ?? []) ?? [];
      text = days.length
        ? `${every}${rule.interval > 2 ? " weeks on" : ""} ${days.join(", ")}`
        : `${every} week${plural}`;
      break;
    }
    case "MONTHLY": {
      const md = rule.byMonthDay?.[0];
      const on = md === undefined ? "" : md === -1 ? " on the last day" : ` on the ${ordinal(md)}`;
      text = `${every} month${plural}${on}`;
      break;
    }
    case "YEARLY": {
      const month = rule.byMonth?.[0];
      const md = rule.byMonthDay?.[0];
      text = `${every} year${plural}${month && md ? ` on ${MONTH_NAMES[month - 1]} ${md}` : ""}`;
      break;
    }
  }
  if (rule.byHour !== undefined) text += ` at ${formatClock(rule.byHour, rule.byMinute ?? 0)}`;
  return text;
}
