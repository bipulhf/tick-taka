# Tick & Taka — Implementation Plan

Source: `tick_taka_spec.pdf` (Product & Technical Spec, 4 Oct 2026).

The spec ships all 63 features in one release. This plan orders the work so each
phase builds on a tested foundation. Every phase ends with tests passing and one
commit.

## Scope changes

- **SMS auto-capture is dropped** (spec pp. 17–18, build checklist p. 36: "SMS
  auto-capture and review panel", "Receipt and SMS scan"). Google Play restricts
  `READ_SMS`/`RECEIVE_SMS` to default SMS apps, and the owner chose not to hold
  message permissions at all, so the build blocks them. Receipt photos (AI scan) and
  quick-add cover the same capture need. Every SMS item below is marked *dropped*.

## Repository layout

```
tick-taka/
  package.json              Bun workspaces (apps/*, packages/*)
  apps/
    api/                    Bun + Hono + Drizzle + SQLite, pm2 config, croner jobs
      src/
        db/                 schema, client, seed
        lib/                errors, ids, time, money, auth helpers
        middleware/         auth, rate limit, error handler
        modules/<feature>/  routes.ts + service.ts per feature
        ai/                 OpenAI client, prompts, tools, usage cap
        jobs/               scheduler, backup, overdue bills
      test/                 bun test suites (in-memory SQLite)
    mobile/                 Expo + Expo Router app (Android only)
      src/app/              file-based routes (tabs: today, plan, add, money, review)
      src/features/<name>/  screens' components, hooks, queries
      src/components/       shared UI (Card, Chip, Sheet, Amount, Tiki…)
      src/lib/              api client, query client, offline queue, notifications
      modules/sms-reader/   local Expo module (Kotlin) (dropped)
  packages/
    shared/                 Zod schemas, domain logic shared by phone and server:
                            quick-add parser, recurrence parser, calculator,
                            money/date helpers (SMS templates dropped)
```

The mobile app imports only `AppType` from `apps/api` for the Hono RPC client,
plus pure logic and schemas from `packages/shared`.

## Phases

### Phase 0 — Workspace scaffold
- Bun workspaces, TypeScript strict base config, Biome lint/format, `.gitignore`.
- `packages/shared` skeleton with `bun test`.
- Test: `bun run typecheck`, `bun test`.

### Phase 1 — Shared domain logic (`packages/shared`)
- Money: minor units, `formatTaka`, currency minor digits.
- Dates: local date strings in Asia/Dhaka, month helpers, days left in month.
- Calculator keypad expression evaluator (`1850/3` → 617).
- Recurrence in plain words → RRULE, and next-occurrence computation.
- Quick-add parser (expense / income / task / time entry, account and category hints).
- ~~SMS: OTP filter, template builder from samples, parser, masking, fingerprint.~~ Dropped.
- Zod schemas for every API entity (single source of truth for validation).
- Test: unit tests for every parser and helper.

### Phase 2 — API foundation
- Drizzle schema for all 25 tables with conventions (ULID ids, epoch ms,
  soft delete, indexes), generated migrations, WAL client, migrate on start.
- Env validation, error envelope `{ error: { code, message } }`, Zod validator
  wrapper, JWT auth (30 days), login rate limit (5 / 15 min / X-Real-IP),
  `/health`, settings with defaults, default seed (areas, categories, routines).
- Generic soft-delete CRUD helper with last-write-wins on `updated_at`.
- pm2 `ecosystem.config.cjs`, Nginx config in `deploy/`.
- Test: auth, rate limit, validation errors, migrations on in-memory DB.

### Phase 3 — Time API
- Areas, projects, routines (+ steps), tasks (filters, one-level subtasks,
  top three, evening/someday, do-date vs deadline, energy, repeat on completion),
  overdue rescue, timer start/stop, time entries, habits + logs + streaks with
  2 freeze days a month, logbook search, focus statistics.
- Test: service and route tests.

### Phase 4 — Money API
- Accounts with computed balances, balance check, transactions (filters, text
  search, cursor paging, transfer fees, cross-currency), categories (2 levels),
  budgets (3 buckets, rollover, spent-so-far), recurring bills/income (pay /
  received, next_due_at), goals (+ suggested monthly amount), debts (+ payoff
  forecast), events, shopping lists (checkout to one transaction),
  category rules (learn from corrections), receipt uploads (SMS imports dropped).
- Test: balance reconciliation, budget math, recurring pay flow.

### Phase 5 — Cross-cutting API
- `/today` aggregate (agenda, top three, safe-to-spend, habits, running timer,
  bills, day-fit), insights summary (by category/area/day, hours by area,
  effective hourly rate, net worth), pace alert, subscription spotter, weekly
  recap, area dashboard, goals-become-tasks, gamification (sparks, levels,
  streaks), weekly/monthly review data, `/sync/changes`, `/export`,
  croner jobs (overdue bills, nightly `VACUUM INTO` backup keeping 14).
- Test: aggregate correctness, sync, export, backup rotation.

### Phase 6 — AI API
- OpenAI client (key and model names from env), Structured Outputs from shared
  Zod schemas, `ai_usage` logging with monthly cap and off switch, masking.
- `/ai/parse`, `/ai/receipt`, `/ai/categorize`, `/ai/plan-day`,
  `/ai/breakdown`, `/ai/weekly-review`, `/ai/ask` (function calling over
  read-only query functions), `/ai/budget-suggestions`.
- Test: with a fake OpenAI client; cap and off switch behaviour.

### Phase 7 — Mobile foundation
- Expo SDK app (Expo Router, TypeScript strict), NativeWind, Nunito, theme
  tokens (light/dark), Hono RPC client, login + secure store, TanStack Query
  persisted cache with offline mutation queue, app lock, privacy mode,
  Tiki SVG mascot (8 expressions), shared UI kit, bottom tabs with centre +.
- Test: typecheck, unit tests, Android bundle export.

### Phase 8 — Today + Quick-add
- Today screen (greeting + Tiki mood, safe-to-spend, top three, timeline with
  day-fit bar, habits row, running timer bar, This Evening, upcoming bills,
  ~~SMS banner~~ dropped), quick-add sheet (on-phone parser, AI fallback, type chips,
  preview line, calculator keypad, cost in hours), sparks + confetti.

### Phase 9 — Plan + time features
- Inbox, projects/areas, task sheet, week planner, calendar (month/week),
  Eisenhower, Someday, Logbook, overdue rescue, focus timer + grow-a-plant,
  time tracking, habits, routines, focus statistics.

### Phase 10 — Money screens
- Accounts, transactions, categories, budgets (buckets), bills, expected income,
  goals, debts (payoff forecast), events, shopping list, money calendar,
  balance check, receipt photo (SMS review panel dropped).

### Phase 11 — Review + settings
- Insights/reports charts, area dashboard, hourly rates, weekly recap card,
  weekly/monthly review flows, daily shutdown, payday plan, AI coach,
  ask my data, budget suggestions, settings (AI cap, advanced views, daily
  goal, vacation mode, quiet hours (SMS sources dropped), export).

### Phase 12 — Android native features
- Local notifications with quiet hours, focus timer notification,
  notification actions (the `sms-reader` module and SMS scan are dropped),
  home-screen widget, app shortcuts, EAS config.

### Phase 13 — Docs and deploy
- README with setup, VPS deploy (pm2 + Nginx + Certbot), backup restore check.

## Verification per phase

- `bun run check` — Biome lint/format, TypeScript in every workspace, and all test
  suites (shared domain logic, API with in-memory SQLite and a scripted AI client,
  mobile pure logic).
- `bunx expo export --platform android` in `apps/mobile` — the whole app bundles with
  Metro for Android.
