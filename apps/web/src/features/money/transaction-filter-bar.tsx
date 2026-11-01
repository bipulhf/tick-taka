import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { inputClass } from "@/components/ui/text-field";
import { formatLocalDate, formatMonth } from "@/lib/format";
import { useAccounts, useCategories } from "@/lib/queries";
import { useThisMonth } from "@/lib/use-today";
import { useEvents } from "./queries";
import {
  categoryOptions,
  recentMonths,
  type TransactionFilters,
  type TypeFilter,
} from "./transaction-filters";

const TYPES: { value: TypeFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

const CLEARED: Partial<TransactionFilters> = {
  q: undefined,
  type: undefined,
  accountId: undefined,
  categoryId: undefined,
  eventId: undefined,
  month: undefined,
  day: undefined,
};

/** One active filter as a chip; its button takes the filter off. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 max-w-64 items-center gap-1 rounded-full bg-ink pr-1 pl-3 text-callout font-semibold text-background">
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-background/20"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

/**
 * Search and the filters as one compact toolbar above the list (type, account,
 * category, month), with what's on shown as removable chips and Clear. In the month
 * view the grid picks the month and the day, so those two stay out.
 */
export function TransactionFilterBar({
  filters,
  onChange,
  monthView = false,
}: {
  filters: TransactionFilters;
  onChange: (patch: Partial<TransactionFilters>) => void;
  monthView?: boolean;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: events = [] } = useEvents();
  const thisMonth = useThisMonth();
  const [q, setQ] = useState(filters.q ?? "");
  const event = events.find((e) => e.id === filters.eventId);
  const account = accounts.find((a) => a.id === filters.accountId);
  const category = categories.find((c) => c.id === filters.categoryId);

  // Typing settles for a moment before the list reloads.
  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const timer = setTimeout(() => onChange({ q: q || undefined }), 300);
    return () => clearTimeout(timer);
  }, [q, filters.q, onChange]);

  // Cleared elsewhere (a chip, Clear, a link): the field follows.
  useEffect(() => {
    if (!filters.q) setQ("");
  }, [filters.q]);

  const pick = (value: string) => (value === NONE ? undefined : value);
  const chips = [
    filters.q ? { key: "q", label: `“${filters.q}”`, patch: { q: undefined } } : null,
    filters.type
      ? {
          key: "type",
          label: TYPES.find((t) => t.value === filters.type)?.label ?? filters.type,
          patch: { type: undefined },
        }
      : null,
    filters.accountId
      ? { key: "account", label: account?.name ?? "Account", patch: { accountId: undefined } }
      : null,
    filters.categoryId
      ? {
          key: "category",
          label: category ? `${category.emoji} ${category.name}` : "Category",
          patch: { categoryId: undefined },
        }
      : null,
    event
      ? { key: "event", label: `${event.emoji} ${event.name}`, patch: { eventId: undefined } }
      : null,
    filters.month && !monthView
      ? { key: "month", label: formatMonth(filters.month), patch: { month: undefined } }
      : null,
    filters.day && !monthView
      ? { key: "day", label: formatLocalDate(filters.day, "long"), patch: { day: undefined } }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-3">
      <search aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-56 sm:flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className={`${inputClass} h-10 pl-9`}
          />
        </div>
        <Segmented
          label="Type"
          options={TYPES}
          value={filters.type ?? "all"}
          onChange={(type) => onChange({ type: type === "all" ? undefined : type })}
          className="w-full sm:w-auto"
        />
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Select
            ariaLabel="Account"
            value={filters.accountId ?? NONE}
            options={[
              { value: NONE, label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            onChange={(id) => onChange({ accountId: pick(id) })}
            className="sm:w-40"
          />
          <Select
            ariaLabel="Category"
            value={filters.categoryId ?? NONE}
            options={[{ value: NONE, label: "All categories" }, ...categoryOptions(categories)]}
            onChange={(id) => onChange({ categoryId: pick(id) })}
            className="sm:w-44"
          />
          {monthView ? null : (
            <Select
              ariaLabel="Month"
              value={filters.month ?? NONE}
              options={[
                { value: NONE, label: "Any time" },
                ...recentMonths(thisMonth).map((m) => ({ value: m, label: formatMonth(m) })),
              ]}
              onChange={(month) => onChange({ month: pick(month), day: undefined })}
              className="col-span-2 sm:w-36"
            />
          )}
        </div>
      </search>
      {chips.length > 0 ? (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <FilterChip label={chip.label} onRemove={() => onChange(chip.patch)} />
            </li>
          ))}
          <li>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ("");
                onChange(CLEARED);
              }}
            >
              Clear
            </Button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
