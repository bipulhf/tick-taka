import { hiddenAmount } from "@tick-taka/shared/money";
import { describeDraft, type QuickAddKind } from "@tick-taka/shared/quick-add";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Circle,
  type LucideIcon,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RowMark } from "@/components/ui/group";
import { Kbd } from "@/components/ui/kbd";
import { NONE, Select } from "@/components/ui/select";
import { formatAmount, formatWhen, plural } from "@/lib/format";
import { privacyStore, usePrivacy } from "@/lib/prefs";
import type { DayChoice } from "./quick-add-requests";
import type { useQuickAdd } from "./use-quick-add";

type QuickAdd = ReturnType<typeof useQuickAdd>;

const KINDS: { value: QuickAddKind; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "time_entry", label: "Time" },
];

/** What "Auto" understood, shown in the Kind field. */
const KIND_NAME: Record<string, string> = {
  task: "Task",
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  time_entry: "Time",
};

const DAYS: { value: DayChoice; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "evening", label: "Evening" },
  { value: "inbox", label: "Inbox" },
  { value: "someday", label: "Someday" },
];

const KIND_LOOK: Record<string, { icon: LucideIcon; tone: "coral" | "mint" | "sky" }> = {
  expense: { icon: ArrowUpRight, tone: "coral" },
  income: { icon: ArrowDownLeft, tone: "mint" },
  transfer: { icon: ArrowLeftRight, tone: "sky" },
  task: { icon: Circle, tone: "sky" },
  time_entry: { icon: Timer, tone: "sky" },
};

const NO_AMOUNT = "no amount yet";

/** The one-line summary of a draft: "Expense ৳20 · Food · Cash · Today". */
export function draftSummary(qa: QuickAdd): string | null {
  const { draft, reference } = qa;
  if (!draft) return null;
  const when = (ms: number, hasTime: boolean) => formatWhen(ms, hasTime, Date.now(), qa.timeZone);
  // Hide amounts covers this line too; the field above still shows what was typed.
  const money = (minor: number) => (privacyStore.get() ? hiddenAmount() : formatAmount(minor));
  if (draft.kind === "transfer") {
    const amount = draft.amountMinor === null ? NO_AMOUNT : money(draft.amountMinor);
    return `Transfer ${amount} · ${when(draft.occurredAt, false)}`;
  }
  const names = {
    account:
      "accountId" in draft ? reference.accounts.find((a) => a.id === draft.accountId)?.name : null,
    category:
      "categoryId" in draft
        ? reference.categories.find((c) => c.id === draft.categoryId)?.name
        : null,
    area: reference.areas.find((a) => a.id === draft.areaId)?.name,
  };
  const text = describeDraft(draft, names, money, when).replace("—", NO_AMOUNT);
  return draft.kind === "expense" || draft.kind === "income"
    ? `${text} · ${when(draft.occurredAt, false)}`
    : text;
}

/** Small pickers for the parts the parser can get wrong; each changes only that part. */
function Fixes({ qa }: { qa: QuickAdd }) {
  const { draft, reference, overrides, setOverrides } = qa;
  const money = draft?.kind === "expense" || draft?.kind === "income" ? draft : null;
  const areaId = draft && draft.kind !== "transfer" ? draft.areaId : null;
  const set = (patch: Partial<typeof overrides>) => setOverrides({ ...overrides, ...patch });
  const pick = "min-w-32 [&_button]:whitespace-nowrap";
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        size="sm"
        className={pick}
        ariaLabel="Kind"
        value={qa.kind ?? NONE}
        options={[
          { value: NONE, label: draft ? `Auto · ${KIND_NAME[draft.kind] ?? "Auto"}` : "Auto" },
          ...KINDS,
        ]}
        onChange={(kind) => qa.setKind(kind === NONE ? null : (kind as QuickAddKind))}
      />
      {draft?.kind === "task" ? (
        <Select
          size="sm"
          className={pick}
          ariaLabel="When"
          value={overrides.day ?? NONE}
          options={[{ value: NONE, label: "As typed" }, ...DAYS]}
          onChange={(day) => set({ day: day === NONE ? undefined : (day as DayChoice) })}
        />
      ) : null}
      {money ? (
        <>
          <Select
            size="sm"
            className={pick}
            ariaLabel="Account"
            placeholder="Account"
            value={money.accountId}
            options={reference.accounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(id) => set({ accountId: id })}
          />
          <Select
            size="sm"
            className={pick}
            ariaLabel="Category"
            placeholder="Category"
            value={money.categoryId}
            options={reference.categories
              .filter((c) => c.kind === money.kind)
              .map((c) => ({ value: c.id, label: c.name, leading: c.emoji }))}
            onChange={(id) => set({ categoryId: id })}
          />
        </>
      ) : null}
      {draft && draft.kind !== "transfer" ? (
        <Select
          size="sm"
          className={pick}
          ariaLabel="Area"
          value={areaId ?? NONE}
          options={[
            { value: NONE, label: "No area" },
            ...reference.areas.map((a) => ({ value: a.id, label: a.name, leading: a.emoji })),
          ]}
          onChange={(id) => set({ areaId: id === NONE ? null : id })}
        />
      ) : null}
    </div>
  );
}

/**
 * Floats under the quick-add field while typing: what the parser understood, the
 * pickers to fix it, and Save. Never a modal: the page stays where it was.
 */
export function QuickAddPreview({
  qa,
  summaryId,
  canSave,
  saving,
  onSave,
  onMore,
  onAddAccount,
}: {
  qa: QuickAdd;
  summaryId: string;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onMore: () => void;
  /** Opens the account panel on top; closing it comes back here with the text. */
  onAddAccount: () => void;
}) {
  const { draft, reference } = qa;
  // Redraw when Hide amounts changes; draftSummary reads it.
  usePrivacy();
  const summary = draftSummary(qa);
  const look = draft ? KIND_LOOK[draft.kind] : null;
  const moneyKind = draft?.kind === "expense" || draft?.kind === "income";
  const sure = Boolean(draft && summary) && !qa.showPickers;
  const fixes = useRef<HTMLDivElement>(null);
  const [focusFixes, setFocusFixes] = useState(false);

  // "Change" goes away as the pickers come back, so focus moves to the first of them.
  useEffect(() => {
    if (!focusFixes || !qa.showPickers) return;
    fixes.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
    setFocusFixes(false);
  }, [focusFixes, qa.showPickers]);

  const mark = qa.aiBusy ? (
    <span
      role="status"
      aria-label="Reading it"
      className="flex size-9 shrink-0 items-center justify-center"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-mango border-t-transparent" />
    </span>
  ) : look ? (
    <RowMark icon={look.icon} tone={look.tone} />
  ) : null;
  const line = (
    <p className={summary ? "flex-1 text-body font-bold" : "flex-1 text-callout text-muted"}>
      {summary
        ? `${qa.aiUsed ? "✨ " : ""}${summary}`
        : "Type a task, an expense, “+45000 salary” or “2h thesis”."}
    </p>
  );
  return (
    <div className="absolute inset-x-0 top-full z-40 mt-2 flex animate-fade-in flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-xl shadow-ink/10 max-sm:fixed max-sm:inset-x-3 max-sm:top-[68px] max-sm:mt-0">
      <div id={summaryId} aria-live="polite" className="flex min-h-9 items-center gap-3">
        {sure ? (
          // Sure of the kind, amount, category and account: one line, and Change for the pickers.
          <button
            type="button"
            aria-expanded={false}
            aria-label={`${summary}. Change kind, account or category`}
            onClick={() => {
              qa.openPickers();
              setFocusFixes(true);
            }}
            className="-m-1 flex flex-1 items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-line/40"
          >
            {mark}
            {line}
            <span className="shrink-0 px-2 text-callout font-bold text-sky-text">Change</span>
          </button>
        ) : (
          <>
            {mark}
            {line}
          </>
        )}
      </div>
      {qa.hoursOfWork ? (
        <p className="-mt-2 pl-12 text-callout text-muted">
          ≈ {plural(qa.hoursOfWork, "hour")} of work
        </p>
      ) : null}
      {draft && !sure ? (
        <div ref={fixes}>
          <Fixes qa={qa} />
        </div>
      ) : null}
      {moneyKind && reference.accountsLoaded && reference.accounts.length === 0 ? (
        <Button size="sm" className="self-start" onClick={onAddAccount}>
          Add your first account
        </Button>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <p className="mr-auto hidden items-center gap-1.5 text-caption font-normal text-muted sm:flex">
          <Kbd>Enter</Kbd> saves <span aria-hidden>·</span> <Kbd>⇧</Kbd>
          <Kbd>Enter</Kbd> all details <span aria-hidden>·</span> <Kbd>Esc</Kbd> clears
        </p>
        <Button size="sm" variant="ghost" onClick={onMore} className="max-sm:mr-auto">
          All details
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} disabled={!canSave} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}
