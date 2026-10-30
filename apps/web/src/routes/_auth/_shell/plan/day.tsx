import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isLocalDate } from "@tick-taka/shared/dates";
import { DayTimeline } from "@/features/plan/day-timeline";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";
import { useTodayDate } from "@/lib/use-today";

interface DaySearch extends PanelSearch {
  date?: string;
}

export const Route = createFileRoute("/_auth/_shell/plan/day")({
  validateSearch: (search: Record<string, unknown>): DaySearch => ({
    ...validatePanelSearch(search),
    date: typeof search.date === "string" && isLocalDate(search.date) ? search.date : undefined,
  }),
  component: DayPage,
});

function DayPage() {
  const { date } = Route.useSearch();
  const today = useTodayDate();
  const navigate = useNavigate();
  return (
    <DayTimeline
      date={date ?? today}
      onDateChange={(next) =>
        void navigate({
          to: ".",
          search: (previous: DaySearch) => ({
            ...previous,
            date: next === today ? undefined : next,
          }),
        })
      }
    />
  );
}
