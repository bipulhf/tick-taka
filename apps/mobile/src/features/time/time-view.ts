/** Time shows every entry, or only focus sessions with the focus chart. */
export type TimeView = "all" | "focus";

export const TIME_VIEWS: { value: TimeView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "focus", label: "Focus only" },
];
