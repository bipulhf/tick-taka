import { formatLocalDate } from "@/lib/format";

export type BillStatus = "overdue" | "due_today" | "due_soon" | "upcoming";

/**
 * A bill's state in calm words: a late bill says when it was due ("Was due Mon 5 Oct"),
 * never "Overdue" (PRODUCT.md: no overdue alarms). Empty for anything further off.
 */
export function billStatusText(status: BillStatus, dueDate?: string | null): string {
  switch (status) {
    case "overdue":
      return dueDate ? `Was due ${formatLocalDate(dueDate)}` : "From earlier";
    case "due_today":
      return "Due today";
    case "due_soon":
      return "Due soon";
    default:
      return "";
  }
}
