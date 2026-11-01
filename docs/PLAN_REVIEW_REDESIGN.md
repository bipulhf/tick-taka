# Plan and Review pages on the web: redesign brief

1 Nov 2026. Same treatment as the Money pages (`docs/MONEY_REDESIGN.md`, live since
ef062b2): every page answers "how am I doing?" and "what needs me?" before its list, with
one mango action, totals where they matter, calm status pills, full width at desk size.
Web only. Reuse the Money pass's shared components (`components/ui/stat-tile.tsx`
SummaryStrip/StatTile, `status-pill.tsx`, `list-section.tsx`, `page-header.tsx` with
`primary` and `summary`, `progress.tsx` with `marker`, `folded-section`, `card-grid` /
`item-card`). Add a shared variant only when two pages need it.

## Plan

- **Inbox and upcoming** (Plan home): strip Left today, Overdue, Inbox, Planned this
  week (tasks and hours). Inbox rows get inline triage (Today, Tomorrow, Someday) on
  hover/focus; Upcoming grouped by day with a count and planned time per day; Areas as a
  compact card grid (open tasks, hours this week). One action: New task.
- **Day**: strip Planned vs free time (day capacity), Tasks left, Focus today; the
  timeline itself unchanged in behaviour, tidier hour rail and now-line.
- **Week**: each day column shows its load (planned minutes against the day's free time)
  as a small bar and a total; the week's total at the top.
- **Calendar**: month grid with per-day task counts and bill marks (legend once), today
  ringed, selected day's list beside the grid at desk width.
- **Someday**: count and a "pick one for this week" nudge (moves to Inbox/Upcoming).
- **Logbook**: strip Done today, This week, This month; grouped by day with counts.
- **Habits**: strip Done today (x of y), This week's completion, Best current streak;
  habits as cards with the last 7 days as dots and the streak.
- **Routines**: cards with step count, total minutes, last run; Start as the action.
- **Time**: strip This week, Focus, Billable, Top area; hours by area as bars; entries
  grouped by day with day totals. All / Focus only stays.
- **Area, project, routine pages**: the summary uses the same SummaryStrip.

## Review

- **Overview**: the rituals (Shutdown, Weekly, Monthly, Reports) as cards with their
  state ("Done tonight", "Due Friday", "Last done 3 Oct") and streaks; a this-week strip
  (tasks done, hours, spent, habits).
- **Shutdown and Weekly**: a clear stepper (step names, current, done), each step's
  numbers in a strip, Back/Next anchored at the bottom of the content.
- **Monthly**: strip Spent, Earned, Saved, Budgets kept (x of y); budgets vs actual as
  bars with the limit marked; the "Plan next month" link stays.
- **Reports**: period switcher (week, month, 3 months, year) in the header, a strip for
  the period, every chart in the same card style with a title and one-line takeaway.

## Rules

- Existing API data only; report anything that needs a new endpoint.
- 1440, 1024, 390; light and dark; Hide amounts; Bangla digits for amounts.
- Keyboard row navigation, URL panels, Undo toasts, page titles, the tour targets keep
  working. Copy short, friendly, no em dashes, no guilt.
