import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

/** Time shows every entry, or only focus sessions with the focus chart. */
export type TimeView = "all" | "focus";

/** The Time view's search: `?view=focus` for Focus only (old Focus statistics links). Pure. */
export interface TimeSearch extends PanelSearch {
  view?: "focus";
}

export function validateTimeSearch(search: Record<string, unknown>): TimeSearch {
  return {
    ...validatePanelSearch(search),
    view: search.view === "focus" ? "focus" : undefined,
  };
}

export const TIME_VIEWS: { value: TimeView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "focus", label: "Focus only" },
];
