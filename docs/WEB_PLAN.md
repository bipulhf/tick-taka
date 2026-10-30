# Tick & Taka on the web: plan

Goal: every feature of the Android app in a browser, designed for a laptop first and
still comfortable in a phone browser. Same account, same API, same data.

Decided with the owner (30 Oct 2026):

- **Laptop first.** Sidebar navigation, multi-column screens, edit panels, keyboard
  shortcuts and a command palette. A phone browser gets a bottom tab bar and sheets.
- **Online only.** No offline cache or write queue. When the connection drops, a banner
  says so and saving waits for it; nothing is queued behind the user's back.
- **Same identity, desk density.** DESIGN.md's tokens, Nunito, warm paper and warm
  charcoal, mango for the one primary action and colour only for meaning. The type
  scale and row heights shrink for a mouse and keyboard.

## Design brief

**Summary.** A desk companion for the same person who uses the phone app: the owner
juggling two remote jobs, teaching, research and home. On the laptop they plan the week,
clear the inbox, reconcile money and do the reviews; on the phone they capture.

**Primary action.** Capture anything from anywhere in one field ("cha 20", "2h thesis",
"call bank tomorrow 5pm"), and see at a glance what's next and what is safe to spend.

**Scene.** Morning at a desk by a window, planning the day on a 14" laptop before work
starts (light: warm paper); late at night on the sofa doing the shutdown review with the
lights low (dark: warm charcoal). The theme follows the system, with Light and Dark
pinnable in Settings, as on the phone.

**Colour strategy.** Restrained, as DESIGN.md. Tinted neutrals, mango only for the
primary action of a view, sky for time, mint and coral for money in and out, grape for
habits. The sidebar is a second neutral layer a step darker than the page.

**Anchors.** Things 3 for Mac (calm lists, one bold title, generous air), Linear (side
navigation, command palette, keyboard flow, side panels instead of pages), Copilot Money
on the web (one big number, quiet charts).

**Anti-goals.** An admin panel: tables of grey boxes, toolbars of equal buttons, modals
for every edit. Guilt UI. A phone layout stretched across a wide screen.

## Stack

- `apps/web`: Vite, React 19, TypeScript strict, in the Bun workspace like the others.
- Routing: TanStack Router (file routes, typed search params). Edit panels live in the
  URL (`?task=<id>`, `?new=expense`), so Back closes them and links open them.
- Data: TanStack Query, the typed Hono RPC client (`AppType`) through ky, exactly as the
  phone does. Pure logic comes from `@tick-taka/shared` (quick-add parser, recurrence,
  money and date helpers, Tiki's mood and lines).
- UI: Tailwind CSS v4 with DESIGN.md's tokens as CSS variables, Radix primitives for
  dialogs, popovers, menus, tooltips and selects, `cmdk` for the palette, `dnd-kit` for
  drag to schedule, `lucide-react` icons, Nunito self-hosted through Fontsource.
- Charts: small hand-built SVG components (bars, lines, rings) on the same tokens.
- Tests: `bun test` for pure modules; `tsc` and Biome as for the rest of the repo; a
  Playwright script that signs in with the demo account and screenshots every route.

## Hosting and sign-in

- Same origin as the API: Nginx serves the built app from `/app/` and keeps proxying
  everything else to the API, so no CORS and no API change. Locally, Vite serves
  `/app/` and proxies `/api/*` to the API on port 3000.
- Sign in with Google Identity Services: the "Sign in with Google" button returns an ID
  token for the same Web client ID the phone uses, which `/auth/google` already accepts.
  The Google Cloud client needs the site's origin (and `http://localhost:5173`) under
  Authorised JavaScript origins.
- The session token is kept in `localStorage` and swapped for a fresh one once it is a
  day old (`/auth/refresh`), as on the phone. Sign out calls `/auth/logout` and clears
  everything. A strict Content-Security-Policy in Nginx limits scripts to the app and
  Google's sign-in, which is what makes a browser-stored token acceptable.
- A demo sign-in (`VITE_DEMO_SIGN_IN=1`, `?demoToken=`) mirrors the phone's screenshot
  build, for local development and screenshots. Real builds refuse it.

## App shell

- **Wide (1024 px and up):** a 248 px sidebar on a second neutral layer: Tiki and the
  account at the top; Today, Plan, Money, Review with their sub-pages; areas and their
  projects; Settings at the bottom. A slim top bar holds the quick-add field (centre),
  the running timer pill, the hide-amounts switch and the Tiki chat toggle.
- **Edit panel:** 440 px, slides in from the right over the content without a dimmed
  backdrop, so the list stays visible and clickable. The action is pinned at its foot.
  Escape or Back closes it; unsaved changes ask once.
- **Tiki dock:** the chat opens as a right column beside the content (not over it), so
  the user can watch Tiki's changes land in the list next to it.
- **Medium (640 to 1023 px):** the sidebar collapses to an icon rail with tooltips.
- **Narrow (under 640 px):** the Android layout: a bottom tab bar (Today, Plan, mango
  +, Money, Review), panels as full-height sheets, Tiki full screen.

## Capture and keyboard

- Quick-add is always in the top bar. `N` or `/` focuses it. As the user types, a line
  under the field shows what the parser understood ("Expense ৳20 · Food · Cash · today")
  with each part a small picker to fix it; Enter saves, Shift+Enter opens the full panel.
  Unclear text falls back to `/ai/parse`, receipts can be dropped or pasted on it.
- Command palette (`Ctrl/⌘ K`): go anywhere, search tasks and transactions, and run
  actions (new expense, start focus, plan my day, hide amounts, switch theme).
- Lists: `J`/`K` move, `X` completes, `Enter` opens, `Delete` removes with Undo, `T`
  adds to top three, `D` sets the do-date. `G` then a letter jumps (`G T` Today, `G P`
  Plan, `G M` Money, `G R` Review). `?` lists every shortcut.
- Every destructive change shows an Undo toast for 8 seconds, as the phone's snackbar.

## Screens

Each phone screen exists on the web; the layout changes, the content and wording stay.

**Today** (`/app/`): header with date, daily-goal progress and Tiki's line. Two columns:
time on the left (the next thing, top three, next up with the day-fit bar, evening and
"later"), money on the right (safe to spend as the one hero card, the pace note, bills,
paydays and debts due, habit rings, the four most-logged quick logs). Overdue rescue and
"plan my day" appear as gentle rows, never alarms.

**Plan:** Inbox, Upcoming, Day timeline, Week planner (drag tasks between days and onto
hours), Calendar month, Someday, Logbook with search, Eisenhower grid (drag between
quadrants), areas with their projects, Habits, Routines (runner), Time tracking and
Focus stats. The task panel holds every field: notes, subtasks, do-date and time,
evening, deadline, priority, urgent, energy, estimate, reminder, repeat in plain words,
area and project, "break it down" with AI.

**Focus** (`/app/focus`): full-window timer with the growing plant, task picker, presets,
and the bell at the end. The timer keeps running in the top bar when the user leaves.

**Money:** Overview (total, accounts, this month's budgets at a glance, recent),
Transactions (calm table with search, filters by type, account, category and month,
paging, receipt thumbnails), Budgets (month stepper, flexible, fixed and non-monthly
groups, inline amounts, rollover, AI suggestions), Bills and income (pay, skip, undo),
Goals, Debts (repay, payoff forecast), Events and trips, Shopping list (checkout to one
expense), Spending calendar, Accounts (transfers, fees, balance check, foreign currency).

**Review:** hub, Shutdown (a stepper: done today, carry over, tomorrow's top three,
spending check), Weekly (with the AI coach), Monthly, Reports (spending by category,
area and day, hours by area, hourly rate, net worth), Area dashboards, Payday plan,
Subscription spotter, AI usage.

**Tiki:** streaming chat, Bangla and English, voice through the microphone and
`/ai/transcribe`, Undo on applied changes, money drafts to confirm, deletions that wait
for a click, clear chat.

**Settings:** one page with a section list: Appearance (theme, accent theme, digits,
reduce sounds), Today and planning (daily goal, time zone, week start, workday hours,
vacations), Money (default and cash accounts, currency), Areas and categories (with
rules), Notifications, AI features, Privacy (hide amounts), Data (JSON export), Account
(sign out, delete account after the export question).

**Sign in:** Tiki, one line of purpose, the Google button. A note when the session
expired or the account was deleted.

## What changes on the web

- Home-screen widget: Today is the widget; the app can be installed (web manifest) and
  offers launcher shortcuts for Task, Expense and Focus.
- Fingerprint lock: not offered. Hide amounts stays.
- Notifications: task reminders and the focus bell use browser notifications while a
  tab is open, after the user turns them on in Settings. Nothing rings with the tab closed.
- Haptics: none. Sounds use the same four sound files, mixed quietly, each switchable.
- Receipts: file picker, drag and drop, or paste a screenshot.
- Export: downloads the JSON file directly.
- Offline: not supported (see above).

## States

Every view has: skeleton while loading (never a spinner in the content), an empty
state that teaches ("Inbox zero. New tasks land here until they have a day."), an error
with Retry, the offline banner, and "Signed out. Sign in again" on an expired session.
Saving shows on the button itself; failures keep what was typed.

## Accessibility

WCAG AA in both themes with the existing token pairs, visible focus rings on every
control, every action reachable by keyboard, landmarks and headings per view, live
region for toasts and Tiki's replies, reduce-motion honoured, colour never the only cue.

## Phases

Each phase ends with typecheck, lint and tests passing and its own commits.

1. **Foundation:** workspace, Vite, tokens, fonts, base components (button, field,
   picker, toggle, checkbox, row, group, panel, toast, skeleton, empty state, amount),
   API client, auth and sign-in, app shell with all routes in the sidebar.
2. **Today and capture:** Today, quick-add with parser preview, task panel, running timer,
   top three picker, habit taps, Undo toasts and celebrations.
3. **Plan and time:** every Plan view, drag to schedule, areas and projects, habits,
   routines, time tracking, focus mode and stats.
4. **Money:** every Money view and panel.
5. **Review:** every Review view and charts.
6. **Tiki:** chat dock, streaming, drafts, Undo, voice.
7. **Settings and data:** settings, export, delete account, notifications, palette
   actions, keyboard help.
8. **Polish and ship:** responsive and accessibility pass, manifest, Nginx config and
   CSP, README section, screenshots from the demo account.

Phases 3, 4 and 5 touch separate folders and can be built side by side once 2 lands.
