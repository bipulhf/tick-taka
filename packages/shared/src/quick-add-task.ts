/**
 * The task half of quick-add: priority, evening, someday, do and deadline dates and
 * a repeat, cut out of the text so what is left is the title.
 */

import * as chrono from "chrono-node";
import {
  DEFAULT_TIME_ZONE,
  MINUTE_MS,
  startOfLocalDay,
  timeZoneOffsetMs,
  toLocalDate,
  zonedTimeToUtc,
} from "./dates";
import { toAsciiDigits } from "./digits";
import type { QuickAddContext, TaskDraft } from "./quick-add";
import { guessArea, hasNonLatinLetters } from "./quick-add-guess";
import { firstOccurrence, type ParsedRecurrence, parseRecurrence } from "./recurrence";

const EVENING_RE = /\b(tonight|this evening|in the evening|evening)\b/i;
const SOMEDAY_RE = /\b(someday|some day|one day|eventually)\b/i;
const PRIORITY_HIGH_RE = /(^|\s)(!!?|!high|urgent|asap|important)(?=\s|$)/i;
const PRIORITY_LOW_RE = /(^|\s)(!low|low priority)(?=\s|$)/i;
const DEADLINE_PREFIX_RE = /\b(by|due|deadline|before)\s*$/i;
const BARE_REPEAT_RE = /^(daily|everyday|weekly|monthly|yearly|annually)\b/i;
const REPEAT_LEAD_RE = /(^|\s)(repeats?|repeating|recurring)\s*$/i;

/**
 * Finds a repeat phrase and cuts it out of the text. A bare "weekly" or "monthly" is
 * often just an adjective ("read weekly report"), so it only counts after "repeat",
 * or at the very start or end of the text. There it stays in the title ("Daily
 * standup") and the repeat is only a guess, so the draft is "low" confidence.
 */
function takeRecurrence(
  working: string,
  context: QuickAddContext,
): { recurrence: ParsedRecurrence | null; working: string; guessed: boolean } {
  // Read from an ASCII-digit copy ("every ৩ days"). The copy has the same length, so
  // positions found in it cut the original and the title keeps "৩".
  const ascii = toAsciiDigits(working);
  const recurrence = parseRecurrence(ascii, context.workdays ? { workdays: context.workdays } : {});
  if (!recurrence) return { recurrence: null, working, guessed: false };
  const at = ascii.indexOf(recurrence.phrase);
  const end = at + recurrence.phrase.length;
  const cut = (from: number) => `${working.slice(0, from)} ${working.slice(end)}`;
  const bare = BARE_REPEAT_RE.exec(recurrence.phrase);
  if (!bare) return { recurrence, working: cut(at), guessed: false };
  const lead = REPEAT_LEAD_RE.exec(ascii.slice(0, at));
  if (lead) return { recurrence, working: cut(lead.index), guessed: false };
  const atEdge = ascii.slice(0, at).trim() === "" || /^[\s.,!?]*$/.test(ascii.slice(end));
  if (!atEdge) return { recurrence: null, working, guessed: false };
  // Keep the word itself; drop only a clock time that followed it ("daily 9am").
  return { recurrence, working: cut(at + bare[0].length), guessed: true };
}

export function parseTask(text: string, context: QuickAddContext): TaskDraft {
  const timeZone = context.timeZone ?? DEFAULT_TIME_ZONE;
  let working = text.trim();
  let priority: TaskDraft["priority"] = "normal";
  if (PRIORITY_HIGH_RE.test(working)) {
    priority = "high";
    working = working.replace(PRIORITY_HIGH_RE, " ");
  } else if (PRIORITY_LOW_RE.test(working)) {
    priority = "low";
    working = working.replace(PRIORITY_LOW_RE, " ");
  }
  let whenSlot: TaskDraft["whenSlot"] = "day";
  if (EVENING_RE.test(working)) {
    whenSlot = "evening";
    working = working.replace(/\b(this evening|in the evening|evening)\b/i, " ");
  }
  let status: TaskDraft["status"] = "inbox";
  if (SOMEDAY_RE.test(working)) {
    status = "someday";
    working = working.replace(SOMEDAY_RE, " ");
  }

  const repeat = takeRecurrence(working, context);
  const recurrence = repeat.recurrence;
  working = repeat.working;

  const offsetMinutes = timeZoneOffsetMs(context.now, timeZone) / MINUTE_MS;
  const results = chrono.parse(
    toAsciiDigits(working),
    { instant: new Date(context.now), timezone: offsetMinutes },
    { forwardDate: true },
  );

  let doAt: number | null = null;
  let hasTime = false;
  let deadlineAt: number | null = null;
  const removals: { index: number; length: number }[] = [];
  for (const result of results) {
    const before = working.slice(0, result.index);
    const deadlinePrefix = DEADLINE_PREFIX_RE.exec(before);
    const certainTime = result.start.isCertain("hour");
    const instant = result.start.date().getTime();
    const local = toLocalDate(instant, timeZone);
    if (deadlinePrefix && deadlineAt === null) {
      deadlineAt = certainTime
        ? instant
        : startOfLocalDay(local, timeZone) + (23 * 60 + 59) * MINUTE_MS;
      removals.push({
        index: deadlinePrefix.index,
        length: before.length - deadlinePrefix.index + result.text.length,
      });
    } else if (doAt === null) {
      hasTime = certainTime;
      doAt = certainTime ? instant : startOfLocalDay(local, timeZone);
      removals.push({ index: result.index, length: result.text.length });
    }
  }
  for (const removal of removals.sort((a, b) => b.index - a.index)) {
    working = `${working.slice(0, removal.index)} ${working.slice(removal.index + removal.length)}`;
  }

  let rrule: string | null = null;
  if (recurrence) {
    rrule = recurrence.rrule;
    if (doAt === null) {
      const first = firstOccurrence(recurrence.rule, toLocalDate(context.now, timeZone));
      if (first) {
        const { byHour, byMinute } = recurrence.rule;
        if (byHour !== undefined) {
          const [y, m, d] = first.split("-").map(Number) as [number, number, number];
          doAt = zonedTimeToUtc(
            { year: y, month: m, day: d, hour: byHour, minute: byMinute ?? 0 },
            timeZone,
          );
          hasTime = true;
        } else {
          doAt = startOfLocalDay(first, timeZone);
        }
      }
    }
  }

  const title = working
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
  const strayNumber = /\b\d+(\.\d+)?\b/.test(toAsciiDigits(title));
  return {
    kind: "task",
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : text.trim(),
    doAt: status === "someday" ? null : doAt,
    hasTime: status === "someday" ? false : hasTime,
    reminderAt: hasTime && status !== "someday" ? doAt : null,
    deadlineAt,
    rrule,
    whenSlot,
    status,
    priority,
    areaId: guessArea(text, context),
    confidence:
      title.length > 0 && !strayNumber && !repeat.guessed && !hasNonLatinLetters(title)
        ? "high"
        : "low",
  };
}
