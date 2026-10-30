import { addMonths } from "@tick-taka/shared/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/format";
import { IconButton } from "./icon-button";

/** Previous / next month with the month's name between; `month` is "YYYY-MM". */
export function MonthStepper({
  month,
  onChange,
  max,
}: {
  month: string;
  onChange: (month: string) => void;
  /** The last month that can be shown, usually this one. */
  max?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <IconButton
        icon={ChevronLeft}
        size="sm"
        label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
      />
      <span className="min-w-[5.5rem] text-center text-body font-bold tabular">
        {formatMonth(month)}
      </span>
      <IconButton
        icon={ChevronRight}
        size="sm"
        label="Next month"
        disabled={max !== undefined && month >= max}
        onClick={() => onChange(addMonths(month, 1))}
      />
    </div>
  );
}
