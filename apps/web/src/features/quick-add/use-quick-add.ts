import { costInHours } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import {
  type AnyDraft,
  isSureMoneyDraft,
  liveDefaultAccountId,
  parseQuickAdd,
  type QuickAddContext,
  type QuickAddKind,
} from "@tick-taka/shared/quick-add";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { useAiStatus, useHourlyRate, useReference } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import type { WriteRequest } from "@/lib/write";
import { applyOverrides, draftRequests, type Overrides } from "./quick-add-requests";

const AI_DEBOUNCE_MS = 700;

/**
 * Quick-add state: local parsing on every keystroke, an AI read for ambiguous
 * text when online, and the picks made under the field on top. Nothing is saved
 * until `buildRequests`.
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
  const [pickersOpen, setPickersOpen] = useState(false);
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
      defaultAccountId: liveDefaultAccountId(
        reference.settings?.defaultAccountId,
        reference.accounts,
      ),
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
      !navigator.onLine
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
        // Graceful fallback: the local draft stays.
      } finally {
        if (seq === requestSeq.current) setAiBusy(false);
      }
    }, AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localDraft, text, kind, aiAvailable]);

  const draft = useMemo<AnyDraft | null>(() => {
    const base = aiDraft ?? localDraft;
    return base ? applyOverrides(base, overrides, timeZone) : null;
  }, [aiDraft, localDraft, overrides, timeZone]);

  // A sure read shows one summary line; "Change" (or any doubt) brings the pickers back.
  const showPickers =
    pickersOpen ||
    !isSureMoneyDraft(draft, { accounts: reference.accounts, categories: reference.categories });

  const hoursOfWork = useMemo(() => {
    const settings = reference.settings;
    if (draft?.kind !== "expense" || draft.amountMinor === null || !settings?.costInHours)
      return null;
    if (draft.amountMinor < settings.costInHoursThresholdMinor) return null;
    return costInHours(draft.amountMinor, hourly.data?.rateMinor ?? null);
  }, [draft, reference.settings, hourly.data]);

  /** The writes for the current draft. Null when something is missing. */
  function buildRequests(): WriteRequest[] | null {
    if (!draft) return null;
    const base = aiDraft ?? localDraft;
    const guessed =
      base && (base.kind === "expense" || base.kind === "income") ? base.categoryId : null;
    return draftRequests(draft, overrides, guessed, newId());
  }

  /** Back to an empty field after a save, ready for the next capture. */
  function reset() {
    setText("");
    setKind(null);
    setOverrides({});
    setAiDraft(null);
    setPickersOpen(false);
  }

  return {
    text,
    setText,
    reset,
    kind,
    setKind,
    overrides,
    setOverrides,
    draft,
    aiBusy,
    showPickers,
    openPickers: () => setPickersOpen(true),
    aiUsed: aiDraft !== null,
    hoursOfWork,
    reference,
    buildRequests,
    timeZone,
  };
}
