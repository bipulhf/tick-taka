import type { AnyDraft } from "@tick-taka/shared/quick-add";

export type PresetValue = string | number | boolean | null | undefined;

/** A panel to open and the starting values it reads from `?preset=`. */
export interface PanelTarget {
  panel: string;
  preset?: Record<string, PresetValue>;
}

/**
 * Where Shift+Enter (or "More") takes a quick-add draft: the full panel for its
 * kind, filled with what was understood. The transaction panel reads exactly
 * type, amountMinor, note, categoryId, accountId, occurredAt (and toAccountId for
 * a transfer). Pure.
 */
export function draftPanel(draft: AnyDraft | null): PanelTarget {
  if (!draft) return { panel: "task:new" };
  switch (draft.kind) {
    case "task":
      return {
        panel: "task:new",
        preset: {
          title: draft.title,
          status: draft.status,
          priority: draft.priority,
          doAt: draft.doAt,
          hasTime: draft.doAt === null ? undefined : draft.hasTime,
          whenSlot: draft.whenSlot === "evening" ? "evening" : undefined,
          deadlineAt: draft.deadlineAt,
          rrule: draft.rrule,
          areaId: draft.areaId,
        },
      };
    case "expense":
    case "income":
      return {
        panel: "transaction:new",
        preset: {
          type: draft.kind,
          amountMinor: draft.amountMinor,
          note: draft.note || undefined,
          categoryId: draft.categoryId,
          accountId: draft.accountId,
          occurredAt: draft.occurredAt,
        },
      };
    case "transfer":
      return {
        panel: "transaction:new",
        preset: {
          type: "transfer",
          amountMinor: draft.amountMinor,
          note: draft.note || undefined,
          accountId: draft.accountId,
          toAccountId: draft.toAccountId,
          occurredAt: draft.occurredAt,
        },
      };
    case "time_entry":
      return {
        panel: "time-entry:new",
        preset: {
          note: draft.note || undefined,
          minutes: draft.minutes > 0 ? draft.minutes : undefined,
          startedAt: draft.minutes > 0 ? draft.startedAt : undefined,
          areaId: draft.areaId,
        },
      };
  }
}
