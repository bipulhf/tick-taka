import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NONE, Select } from "@/components/ui/select";
import { inputClass } from "@/components/ui/text-field";
import { formatMonth } from "@/lib/format";
import { useAccounts, useCategories } from "@/lib/queries";
import { useThisMonth } from "@/lib/use-today";
import { useEvents } from "./queries";
import {
  categoryOptions,
  isFiltered,
  recentMonths,
  type TransactionFilters,
  type TypeFilter,
} from "./transaction-filters";

/** Search and the four filters (type, account, category, month), as one quiet column. */
export function TransactionFilterBar({
  filters,
  onChange,
}: {
  filters: TransactionFilters;
  onChange: (patch: Partial<TransactionFilters>) => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: events = [] } = useEvents();
  const thisMonth = useThisMonth();
  const [q, setQ] = useState(filters.q ?? "");
  const event = events.find((e) => e.id === filters.eventId);

  // Typing settles for a moment before the list reloads.
  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const timer = setTimeout(() => onChange({ q: q || undefined }), 300);
    return () => clearTimeout(timer);
  }, [q, filters.q, onChange]);

  const pick = (value: string) => (value === NONE ? undefined : value);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Select
          label="Type"
          value={filters.type ?? NONE}
          options={[
            { value: NONE, label: "All" },
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
          onChange={(type) => onChange({ type: pick(type) as TypeFilter | undefined })}
        />
        <Select
          label="Account"
          value={filters.accountId ?? NONE}
          options={[
            { value: NONE, label: "All" },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
          onChange={(id) => onChange({ accountId: pick(id) })}
        />
        <Select
          label="Category"
          value={filters.categoryId ?? NONE}
          options={[{ value: NONE, label: "All" }, ...categoryOptions(categories)]}
          onChange={(id) => onChange({ categoryId: pick(id) })}
        />
        <Select
          label="Month"
          value={filters.month ?? NONE}
          options={[
            { value: NONE, label: "Any time" },
            ...recentMonths(thisMonth).map((m) => ({ value: m, label: formatMonth(m) })),
          ]}
          onChange={(month) => onChange({ month: pick(month) })}
        />
      </div>
      {event ? (
        <div className="flex items-center gap-2 rounded-xl bg-line/50 py-1.5 pr-1.5 pl-3 text-callout">
          <span className="flex-1 truncate font-semibold">
            {event.emoji} {event.name}
          </span>
          <button
            type="button"
            aria-label={`Stop showing only ${event.name}`}
            onClick={() => onChange({ eventId: undefined })}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
      {isFiltered(filters) ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            setQ("");
            onChange({
              q: undefined,
              type: undefined,
              accountId: undefined,
              categoryId: undefined,
              eventId: undefined,
              month: undefined,
            });
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
