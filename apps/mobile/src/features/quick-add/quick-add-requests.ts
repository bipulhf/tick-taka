import { addDays, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import type { AnyDraft } from "@tick-taka/shared/quick-add";
import type { OutboxRequest } from "@/lib/outbox-policy";

export type DayChoice = "inbox" | "today" | "tomorrow" | "evening" | "someday";

export interface Overrides {
  accountId?: string | null;
  categoryId?: string | null;
  areaId?: string | null;
  day?: DayChoice;
}

/** The parsed draft with the picks made in the sheet on top. */
export function applyOverrides(base: AnyDraft, overrides: Overrides, timeZone: string): AnyDraft {
  if (base.kind === "expense" || base.kind === "income") {
    return {
      ...base,
      accountId: overrides.accountId !== undefined ? overrides.accountId : base.accountId,
      categoryId: overrides.categoryId !== undefined ? overrides.categoryId : base.categoryId,
      areaId: overrides.areaId !== undefined ? overrides.areaId : base.areaId,
    };
  }
  if (base.kind === "time_entry")
    return { ...base, areaId: overrides.areaId !== undefined ? overrides.areaId : base.areaId };
  if (base.kind === "task") {
    const next = {
      ...base,
      areaId: overrides.areaId !== undefined ? overrides.areaId : base.areaId,
    };
    const today = toLocalDate(Date.now(), timeZone);
    switch (overrides.day) {
      case "inbox":
        return {
          ...next,
          status: "inbox",
          doAt: null,
          hasTime: false,
          reminderAt: null,
          whenSlot: "day",
        };
      case "today":
        return {
          ...next,
          status: "open",
          doAt: next.hasTime && next.doAt ? next.doAt : startOfLocalDay(today, timeZone),
          whenSlot: "day",
        };
      case "tomorrow":
        return {
          ...next,
          status: "open",
          doAt: startOfLocalDay(addDays(today, 1), timeZone),
          hasTime: false,
          reminderAt: null,
          whenSlot: "day",
        };
      case "evening":
        return {
          ...next,
          status: "open",
          doAt: next.doAt ?? startOfLocalDay(today, timeZone),
          whenSlot: "evening",
        };
      case "someday":
        return { ...next, status: "someday", doAt: null, hasTime: false, reminderAt: null };
      default:
        return next;
    }
  }
  return base;
}

/**
 * The writes for a draft, ready for the outbox; null when something is missing.
 * `guessed` is the category the parser picked, to learn from a correction.
 */
export function draftRequests(
  draft: AnyDraft,
  overrides: Overrides,
  guessed: string | null,
  id: string,
): OutboxRequest[] | null {
  switch (draft.kind) {
    case "expense":
    case "income": {
      if (draft.amountMinor === null || !draft.accountId) return null;
      const requests: OutboxRequest[] = [
        {
          method: "POST",
          path: "/transactions",
          label: "Couldn't save the transaction",
          body: {
            id,
            type: draft.kind,
            accountId: draft.accountId,
            amountMinor: draft.amountMinor,
            categoryId: draft.categoryId,
            areaId: draft.areaId,
            note: draft.note || null,
            occurredAt: draft.occurredAt,
          },
        },
      ];
      // Learn from corrections: a changed category is remembered for this note.
      if (overrides.categoryId && draft.note && overrides.categoryId !== guessed) {
        requests.push({
          method: "POST",
          path: "/category-rules",
          body: { matchText: draft.note, categoryId: overrides.categoryId, areaId: draft.areaId },
        });
      }
      return requests;
    }
    case "transfer":
      if (draft.amountMinor === null || !draft.accountId || !draft.toAccountId) return null;
      return [
        {
          method: "POST",
          path: "/transactions",
          label: "Couldn't save the transfer",
          body: {
            id,
            type: "transfer",
            accountId: draft.accountId,
            toAccountId: draft.toAccountId,
            amountMinor: draft.amountMinor,
            feeMinor: draft.feeMinor,
            note: draft.note || null,
            occurredAt: draft.occurredAt,
          },
        },
      ];
    case "task":
      if (!draft.title) return null;
      return [
        {
          method: "POST",
          path: "/tasks",
          label: "Couldn't save the task",
          body: {
            id,
            title: draft.title,
            status: draft.status === "inbox" && draft.doAt !== null ? "open" : draft.status,
            priority: draft.priority,
            doAt: draft.doAt,
            hasTime: draft.hasTime,
            reminderAt: draft.reminderAt,
            deadlineAt: draft.deadlineAt,
            rrule: draft.rrule,
            whenSlot: draft.whenSlot,
            areaId: draft.areaId,
          },
        },
      ];
    case "time_entry":
      if (draft.minutes <= 0) return null;
      return [
        {
          method: "POST",
          path: "/time-entries",
          label: "Couldn't save the time entry",
          body: {
            id,
            startedAt: draft.startedAt,
            endedAt: draft.endedAt,
            areaId: draft.areaId,
            note: draft.note || null,
            source: "manual",
          },
        },
      ];
  }
}
