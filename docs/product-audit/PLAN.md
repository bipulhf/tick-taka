# Plan: putting the product audit into the app

From `REPORT.md` (31 Oct 2026). One phase at a time; each phase ends green and committed before the next starts. Deploy once, after the last phase.

## Decisions (owner, 31 Oct 2026)

- **Audience:** the owner plus invited people. New non-owner accounts get neutral defaults; `PRODUCT.md` is updated to say so.
- **Weekly review default:** Friday 19:00 for new users (existing saved settings are untouched). Today, Review home and the reminder all follow the setting.
- **Remove now:** Eisenhower grid (and the Urgent field it needs), Energy tags, Shopping list. Events stay.
- **Phone:** the reminder fix is built and tested in code. Final deploy (owner, 1 Nov 2026) covers API + web only; no APK this round.
- Off-site backups: `BACKUP_OFFSITE_CMD` is not set in production, so the privacy page's "backups removed at once" holds (Q4 closed).
- Not changed: the app name ("TickNTaka" vs "Tick & Taka", Q3) and the AI model env (Q5) — server config, owner's call.

## Gate for every phase

1. `bun run check` (Biome, TypeScript in every workspace, all tests) passes.
2. New behaviour has tests where logic changed (API routes, shared functions, seed, migrations).
3. Web: screenshots of every touched view against the demo API (light, and dark where colours changed); nothing overlapping or empty.
4. Phone: typecheck and tests; device check happens once, in Phase 10.
5. Commits: Conventional Commits, one logical change each, no co-author lines.
6. A short review of the diff before moving on.

Local test rig: demo API from source on `127.0.0.1:3000` (`/tmp/tt-demo/run-api.sh`, restart after API changes), Vite on `:5173/app/`, token from `/tmp/tt-demo/mint.sh`, `bun apps/web/scripts/screenshots.ts --token <t> --path <view>`.

## Phases

| #   | Phase                                    | Recommendations                                                                                                                      | Touches                               | Risk                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------- |
| 1   | **Clear out** dead and unwanted features | R-03, plus removing Eisenhower, Energy, Shopping                                                                                     | API, shared, web, phone, migration    | Medium (migration drops tables/columns) |
| 2   | **Day one works**                        | R-01 Cash account, R-02 inline first budget, R-17 seed one routine, R-24 neutral defaults, `PRODUCT.md`                              | API seed, shared defaults, web, phone | Low                                     |
| 3   | **Small trust fixes**                    | R-04 hide amounts everywhere, R-06 one weekly day + focus on Today, R-07 Save/Complete, R-08 phone Settings from Today, R-23 web 404 | shared, web, phone                    | Low                                     |
| 4   | **Money where it lives**                 | R-09 Payday into Budgets, R-10 Subscriptions into Bills, R-13 spending calendar into Transactions, R-14 one "Plan next month"        | web, phone, (API unchanged)           | Medium (largest UI move)                |
| 5   | **Plan, time, areas**                    | R-12 Focus stats into Time, R-19 calendar month-only with clickable bills, R-11 area summary on the area page                        | web, phone                            | Medium                                  |
| 6   | **Settings**                             | R-15 AI switches 9 → 4, R-16 one Workdays setting (migration), R-18 AI cost behind Settings                                          | shared, API, web, phone, privacy page | Medium (settings migration)             |
| 7   | **Quick-add**                            | R-05 pickers only when the parser is unsure                                                                                          | shared, web, phone                    | Medium                                  |
| 8   | **Server fixes**                         | R-21 receipt cleanup, R-22 goal task in the job, R-25 "last used" per feature in Admin                                               | API, web admin                        | Low                                     |
| 9   | **Reminders**                            | R-20 30-day horizon, background refresh, permission in context                                                                       | phone (native module)                 | Medium                                  |
| 10  | **Docs and deploy**                      | README and privacy page, deploy API + web, live checks (no APK this round)                                                           | all                                   | Low                                     |

### Phase 1 — Clear out

- API: delete `POST /ai/ask` (keep its read tools inside Tiki), `GET /insights/weekly-recap`, `GET /time-entries/by-area`, `POST /ai/categorize` and the `categorize` AI feature flag; delete the shopping module and Tiki's `shopping_item` kind and `checkout_shopping` action; remove `advancedViews` from settings; remove task `urgent` and `energy` if nothing else needs them.
- Migration: drop `sms_imports`, `shopping_items` and the dropped task columns; export and `/sync` stop listing them. Production has 0 shopping rows (checked).
- Web and phone: remove the screens, nav items, palette entries, settings switches, labels, the phone's unused `/task/new` and `/project/new` modes and the notification `addUrl` handler; delete the empty `modules/health/`.
- Old AI usage rows named `categorize` keep a label in the cost formatter.
- Commits: one per removal (endpoints, Auto-categorise, Eisenhower + urgent, energy, shopping, sms table).

### Phase 2 — Day one works

- New users get a "Cash" account set as default and cash account.
- Quick-add never loses typed text: if no account exists, "Add your first account" opens on top and returns.
- Safe-to-spend card, when no flexible budget exists, asks "Spending money this month ৳____" and creates flexible budgets spread over the flexible categories; "Adjust" opens Budgets. Web and phone.
- Seed: only a Morning routine (without "Pick top three"); non-owner users get Work, Study, Home, Personal areas and a neutral side-income category; the owner's seed is unchanged.
- `PRODUCT.md`: users section says owner first, plus invited people like them.

### Phase 3 — Small trust fixes

- Hide amounts covers the widget and bill/income reminder text.
- `weeklyReviewDay` default Friday, 19:00; Today's recap row and Review home's row follow it; phone Settings gets day and time; `weeklyFocus` shows on Today until the next review.
- Web task panel: primary "Save", plus "Complete" with Undo.
- Phone (and web's phone layout): Settings from the Today header; Review loses its Settings row.
- Web 404 page.

### Phase 4 — Money where it lives

- Budgets gains "Plan next month" (3-month average pre-filled, optional "Refine with Tiki") and "Split my pay"; marking a recurring income Received offers the split.
- Bills shows the subscription suggestions inline with Track / Not one.
- Transactions gains List / Month; picking a day filters.
- Monthly review keeps budgets vs actual and links to "Plan next month"; net worth and hourly rate stay only in Reports.
- Remove Review › Payday, Review › Subscriptions, Money › Spending calendar; old URLs redirect.

### Phase 5 — Plan, time, areas

- Time gets All / Focus only with the focus chart; Focus statistics route redirects.
- Plan calendar: month only; bill and payday rows open the bill.
- Area page header: hours this week, money this month, open tasks; Review › Areas removed (redirect); Settings › Areas keeps order, colour, archive.

### Phase 6 — Settings

- AI: master switch + Chat and voice, Smart capture, Planning and coaching (client maps groups to the server's per-feature flags).
- `workdays` becomes the one source; days off = the other days; settings migration keeps each user's current behaviour (tests per default combination); phone gets the control.
- Review › AI usage leaves the nav; reached from Settings › Tiki and AI; the owner's by-user section moves out (Admin has it).
- Privacy page: "switched off by group".

### Phase 7 — Quick-add

- Confident parse (amount, kind, category from a rule or keyword) shows one summary line ("Expense ৳250 · Food · Cash", tap to change); pickers only when unsure. Web and phone.

### Phase 8 — Server fixes

- Permanently deleted transactions delete their receipt file; a one-off sweep removes files no row points to.
- The monthly goal task is made by the hourly per-user job, not by `GET /today`.
- Admin › Usage: "last used" per feature per user from existing timestamps (dates and counts only).

### Phase 9 — Reminders

- Schedule 30 days ahead; background refresh (`expo-background-task`) re-plans while the app is closed.
- Ask notification permission the first time a reminder would matter, with one line of why.

### Phase 10 — Docs and deploy

- README (features, screenshots of changed web views), privacy page wording, `docs/product-audit/REPORT.md` status column.
- Deploy: push `main`, `deploy/update-tick-bipulhf.sh` on the server (migrations run on first open), check `/`, `/app/`, API health, sign-in page.
- No APK this round (owner, 1 Nov 2026). The phone changes wait for the next build, with the device checks each phase listed. The API keeps old 1.2.0 phones working (derived `daysOff`, monthly review fields, `users` in AI usage).

## Status (1 Nov 2026)

| Phase | State                                                                        |
| ----- | ---------------------------------------------------------------------------- |
| 1–8   | Done and committed; API and web deployed                                     |
| 9     | Done in code (phone reminders); waits for the next APK and its device checks |
| 10    | README screenshots refreshed; API and web deployed; no APK this round        |

Every recommendation R-01 to R-25 is in code. Phone-side changes reach users with the next APK; the API keeps 1.2.0 phones working until then.
