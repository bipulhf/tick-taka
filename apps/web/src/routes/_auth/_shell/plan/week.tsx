import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isLocalDate, startOfWeek } from "@tick-taka/shared/dates";
import { WeekPlanner } from "@/features/plan/week-planner";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";
import { useTodayDate, useUserTime } from "@/lib/use-today";

interface WeekSearch extends PanelSearch {
  /** Any day of the week to show. */
  week?: string;
}

export const Route = createFileRoute("/_auth/_shell/plan/week")({
  validateSearch: (search: Record<string, unknown>): WeekSearch => ({
    ...validatePanelSearch(search),
    week: typeof search.week === "string" && isLocalDate(search.week) ? search.week : undefined,
  }),
  component: WeekPage,
});

function WeekPage() {
  const { week } = Route.useSearch();
  const today = useTodayDate();
  const { weekStartsOn } = useUserTime();
  const navigate = useNavigate();
  const thisWeek = startOfWeek(today, weekStartsOn);
  return (
    <WeekPlanner
      weekStart={startOfWeek(week ?? today, weekStartsOn)}
      thisWeek={thisWeek}
      onWeekChange={(next) =>
        void navigate({
          to: ".",
          search: (previous: WeekSearch) => ({
            ...previous,
            week: next === thisWeek ? undefined : next,
          }),
        })
      }
    />
  );
}
