import { onlineManager } from "@tanstack/react-query";
import { addDays, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { costInHours } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import {
  type AnyDraft,
  parseQuickAdd,
  type QuickAddContext,
  type QuickAddKind,
} from "@tick-taka/shared/quick-add";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";
import type { OutboxRequest } from "@/lib/outbox-policy";
import { useAiStatus, useHourlyRate, useReference } from "@/lib/queries";
import { userTime } from "@/lib/user-time";

export type DayChoice = "inbox" | "today" | "tomorrow" | "evening" | "someday";

export interface Overrides {
  accountId?: string | null;
  categoryId?: string | null;
  areaId?: string | null;
  day?: DayChoice;
}

const AI_DEBOUNCE_MS = 700;

/**
 * Quick-add state: on-phone parsing on every keystroke, an AI read for ambiguous
 * text when online, and chip overrides on top. Nothing is saved until `buildRequests`.
 */
export function useQuickAdd(initialText = "", initialKind: QuickAddKind | null = null) {
  const reference = useReference();
  const aiStatus = useAiStatus();
  const hourly = useHourlyRate();
  const [text, setText] = useState(initialText);
  const [kind, setKind] = useState<QuickAddKind | null>(initialKind);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [aiDraft, setAiDraft] = useState<AnyDraft | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const requestSeq = useRef(0);

  const timeZone = userTime(reference.settings).timeZone;
  const context = useMemo<QuickAddContext>(
    () => ({
      now: Date.now(),
      timeZone,
      accounts: reference.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
      })),
      defaultAccountId: reference.settings?.defaultAccountId ?? reference.accounts[0]?.id ?? null,
      categories: reference.categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        parentId: c.parentId,
      })),
      areas: reference.areas.map((a) => ({ id: a.id, name: a.name })),
      rules: reference.rules.map((r) => ({
        matchText: r.matchText,
        categoryId: r.categoryId,
        areaId: r.areaId,
      })),
      workdays: reference.settings?.workdays,
    }),
    [
      reference.accounts,
      reference.categories,
      reference.areas,
      reference.rules,
      reference.settings,
      timeZone,
    ],
  );

  const localDraft = useMemo(
    () => parseQuickAdd(text, { ...context, now: Date.now() }, kind ?? undefined),
    [text, context, kind],
  );
  const aiAvailable = Boolean(
    aiStatus.data?.configured && aiStatus.data.features.parse && !aiStatus.data.capReached,
  );

  // Ambiguous input goes to the AI parser; any failure silently keeps the local draft.
  useEffect(() => {
    setAiDraft(null);
    if (
      !localDraft ||
      localDraft.confidence === "high" ||
      text.trim().length < 4 ||
      !aiAvailable ||
      !onlineManager.isOnline()
    )
      return;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setAiBusy(true);
      try {
        const result = await unwrap(
          api.ai.parse.$post({ json: { text, ...(kind ? { kind } : {}) } }),
        );
        if (seq === requestSeq.current) setAiDraft(result.draft as AnyDraft);
      } catch {
        // Graceful fallback: the on-phone draft stays.
      } finally {
        if (seq === requestSeq.current) setAiBusy(false);
      }
    }, AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localDraft, text, kind, aiAvailable]);

  const draft = useMemo<AnyDraft | null>(() => {
    const base = aiDraft ?? localDraft;
    if (!base) return null;
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
  }, [aiDraft, localDraft, overrides, timeZone]);

  const hoursOfWork = useMemo(() => {
    const settings = reference.settings;
    if (draft?.kind !== "expense" || draft.amountMinor === null || !settings?.costInHours)
      return null;
    if (draft.amountMinor < settings.costInHoursThresholdMinor) return null;
    return costInHours(draft.amountMinor, hourly.data?.rateMinor ?? null);
  }, [draft, reference.settings, hourly.data]);

  /** The writes for the current draft, ready for the outbox. Null when something is missing. */
  function buildRequests(): OutboxRequest[] | null {
    if (!draft) return null;
    const id = newId();
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
        const base = aiDraft ?? localDraft;
        const guessed =
          base && (base.kind === "expense" || base.kind === "income") ? base.categoryId : null;
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

  return {
    text,
    setText,
    kind,
    setKind,
    overrides,
    setOverrides,
    draft,
    aiBusy,
    aiUsed: aiDraft !== null,
    hoursOfWork,
    reference,
    buildRequests,
    timeZone,
  };
}
