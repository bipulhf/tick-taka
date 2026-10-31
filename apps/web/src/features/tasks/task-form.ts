import { addDays, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";

/** The task panel's form: its fields, the blank state a new task starts from, and its body. */

export type Priority = "low" | "normal" | "high";
export type WhenChoice = "today" | "evening" | "tomorrow" | "pick" | "someday" | "none";
export const ESTIMATES = [15, 30, 60, 90, 120, 180];

export interface Form {
  title: string;
  notes: string;
  areaId: string | null;
  projectId: string | null;
  doAt: number | null;
  hasTime: boolean;
  whenSlot: "day" | "evening";
  status: "inbox" | "open" | "someday" | "done";
  deadlineAt: number | null;
  priority: Priority;
  estimateMin: number | null;
  rrule: string | null;
  top3Date: string | null;
}

export const EMPTY: Form = {
  title: "",
  notes: "",
  areaId: null,
  projectId: null,
  doAt: null,
  hasTime: false,
  whenSlot: "day",
  status: "inbox",
  deadlineAt: null,
  priority: "normal",
  estimateMin: null,
  rrule: null,
  top3Date: null,
};

const STATUSES: Form["status"][] = ["inbox", "open", "someday", "done"];
const PRIORITIES: Priority[] = ["low", "normal", "high"];

function num(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A new task's form from `?preset=` (quick-add's Shift+Enter, a Plan view's "Add"):
 * the draft's own fields, or `doDate=YYYY-MM-DD` for "a task on this day". Unknown
 * or malformed values are ignored. Pure.
 */
export function formFromPreset(preset: URLSearchParams, timeZone: string): Form {
  const form: Form = { ...EMPTY };
  const text = (key: string) => preset.get(key);
  form.title = text("title") ?? "";
  form.notes = text("notes") ?? "";
  form.areaId = text("areaId") || null;
  form.projectId = text("projectId") || null;
  form.rrule = text("rrule") || null;
  form.top3Date = text("top3Date") || null;
  form.deadlineAt = num(text("deadlineAt"));
  form.estimateMin = num(text("estimateMin"));
  const status = text("status") as Form["status"] | null;
  if (status && STATUSES.includes(status)) form.status = status;
  const priority = text("priority") as Priority | null;
  if (priority && PRIORITIES.includes(priority)) form.priority = priority;
  if (text("whenSlot") === "evening") form.whenSlot = "evening";
  const doAt = num(text("doAt"));
  const doDate = text("doDate");
  if (doAt !== null) {
    form.doAt = doAt;
    form.hasTime = text("hasTime") === "true";
  } else if (doDate && /^\d{4}-\d{2}-\d{2}$/.test(doDate)) {
    form.doAt = startOfLocalDay(doDate, timeZone);
  }
  // A dated task is planned, not in the inbox.
  if (form.doAt !== null && form.status === "inbox") form.status = "open";
  return form;
}

/** What "When" shows for the form, relative to today. */
export function whenOf(form: Form, today: string, timeZone: string): WhenChoice | null {
  if (form.status === "someday") return "someday";
  if (!form.doAt) return null;
  const date = toLocalDate(form.doAt, timeZone);
  if (date === today) return form.whenSlot === "evening" ? "evening" : "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return "pick";
}

/** The form after picking a "When" (anything but "pick", which needs a date). */
export function withWhen(
  form: Form,
  choice: Exclude<WhenChoice, "pick">,
  today: string,
  timeZone: string,
): Form {
  if (choice === "none")
    return {
      ...form,
      doAt: null,
      hasTime: false,
      whenSlot: "day",
      status: form.status === "open" || form.status === "someday" ? "inbox" : form.status,
    };
  if (choice === "someday") return { ...form, status: "someday", doAt: null, hasTime: false };
  return withDate(form, choice === "tomorrow" ? addDays(today, 1) : today, timeZone, {
    evening: choice === "evening",
  });
}

/** The form on a picked day, keeping no time. */
export function withDate(
  form: Form,
  date: string,
  timeZone: string,
  options: { evening?: boolean } = {},
): Form {
  return {
    ...form,
    doAt: startOfLocalDay(date, timeZone),
    hasTime: false,
    whenSlot: options.evening ? "evening" : "day",
    status: form.status === "inbox" || form.status === "someday" ? "open" : form.status,
  };
}

/** The body a save sends. The reminder rings at the task's time, as on the phone. */
export function taskBody(form: Form, repeatRule: string | null) {
  return {
    ...form,
    title: form.title.trim(),
    notes: form.notes.trim() || null,
    rrule: repeatRule ?? form.rrule,
    reminderAt: form.hasTime ? form.doAt : null,
  };
}
