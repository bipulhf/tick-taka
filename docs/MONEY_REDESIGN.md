# Money pages on the web: redesign brief

1 Nov 2026. Owner asked for every Money page to be "more useful and nicer". Web only
(`apps/web/src/features/money/*`, routes under `routes/_auth/_shell/money/`). Same
identity (DESIGN.md: warm paper, one mango action per page, mint/coral as marks, sky for
time, ink-inverted selection, Nunito, tabular digits), desk density, full width.

## What's wrong today

- Pages are single lists with large empty areas at 1440 px; nothing answers "how am I
  doing?" or "what needs me?" before the list.
- Inconsistent page actions: mango "New" on some pages, outlined "New" on others.
- No totals where they matter (bills due this month, total saved, net owed).
- Debts shows a raw "Monthly payment for a forecast" input on every card.
- Transactions spends a whole column on four filter selects; day groups have no totals.

## Shared pieces (build once, use on every page)

- **Summary strip**: 2 to 4 stat tiles under the page title: label, big tabular number
  (respects Hide amounts and Bangla digits), one short caption or delta, optional tone
  (mint money in, coral money out, neutral). One component with named variants, not
  per-page markup.
- **Page header**: title, the summary strip, and exactly one mango primary action
  ("New …" named for the page: "New bill", "New goal"); secondary actions outlined.
- **Grouped list sections** with a right-aligned group total ("Today · −৳1,270").
- **Status pill**: Overdue, Due soon, Paid, On track, Behind, Done; text + tone, never
  colour alone.
- Empty states keep one action; loading uses skeletons shaped like the new layout.

## Page by page

**Overview** — a dashboard for the month. Net worth hero (all accounts) with this
month's In / Out / Net beside it; Safe to spend today; "Coming up" (bills and paydays in
the next 7 days, with Paid/Received); spending by category this month (top 5 bars, rest
as "Other"); accounts compact list; recent 6 transactions. Two or three columns at desk
width, one on narrow.

**Transactions** — summary strip for the current filter (Spent, Earned, Net, Count).
Filters become one compact toolbar above the list: search, type segmented control
(All / Expenses / Income / Transfers), account, category, month; active filters shown
as removable chips with "Clear". The list takes the full width; each day header carries
the day's net total. List / Month toggle stays.

**Budgets** — strip: Left to spend this month, Daily allowance for the days left,
Spent so far, Days left. Categories sorted by how close to the limit they are within
each bucket; over-limit lines get a coral mark and "over by ৳…"; a thin pace marker on
each bar (where today falls in the month). Plan next month / Split my pay / Edit stay.

**Bills and income** — strip: Due this month, Paid so far, Still to pay, Expected
income. Bills grouped by when: Overdue, This week, Later this month, Next month; each
row: name, due date, how often, amount, status pill, Paid action. Income in its own
column with the same grouping. Subscription suggestions card stays (from the audit).

**Goals** — strip: Total saved, Total target, Put aside per month (sum of the "on
pace" amounts). Goals as a responsive card grid (2 to 3 columns): progress ring with
percent, saved of target, deadline, "On track" / "Behind" / "Done" pill, monthly
amount to stay on pace, Add money.

**Debts** — strip: Owed to me, I owe, Net. Cards per person with progress (repaid of
total), last repayment date, Log a repayment; the payoff forecast moves into the debt's
panel (or a small "Forecast" disclosure), not a bare input on every card. Settled debts
collapse into a "Settled" section.

**Events** — strip: Active now, Upcoming, Spent across events this year. Events grouped
Active / Upcoming / Past; each card: dates, spent of budget with bar, days left.

**Accounts** — strip: Net worth, Cash and wallets, Bank and savings, Cards (owed).
Accounts grouped by type with a group total; each row: balance, a share-of-total bar,
"Check balance" action. Archived accounts in a collapsed section.

## Rules

- Use existing API data; add an endpoint only if a number can't be derived from what the
  app already fetches, and say so.
- Every page works at 1440, 1024 (rail), 390 (phone layout), light and dark, Hide
  amounts on, Bangla digits on.
- Keyboard row navigation (J/K/X/T) and URL panels keep working.
