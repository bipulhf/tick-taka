## Feature assessment

Scores 1–5. **Value** = contribution to the core job (5 = journey breaks without it). **Reach** = **estimate** (production has one account and no records, no analytics; reach is reasoned from where the feature sits and whether it is on by default). **Cost** = UI surface + cognitive load + code + maintenance (5 = expensive). **Dependents** = features that rely on it, counted from `03-connections.md`.

| ID   | Feature                        | Value     | Reach (est.) | Cost | Dep.             | Verdict             | One-line reason                                                                   |
| ---- | ------------------------------ | --------- | ------------ | ---- | ---------------- | ------------------- | --------------------------------------------------------------------------------- |
| F-01 | Google sign-in and sessions    | 5         | 5            | 2    | all              | Required            | No account, no app                                                                |
| F-02 | Public home, privacy, terms    | 2         | 2            | 2    | 1                | Required            | Google OAuth verification                                                         |
| F-03 | Today                          | 5         | 5            | 4    | 9                | Keep                | Core screen, principle 1                                                          |
| F-04 | Quick-add                      | 5         | 5            | 4    | 4                | Simplify            | Pickers on every money entry break principle 2; no-account dead end               |
| F-05 | Safe to spend                  | 5         | 5            | 2    | 2                | Keep                | The core number                                                                   |
| F-06 | Top three                      | 4         | 4            | 2    | 3                | Keep                |                                                                                   |
| F-07 | Task editing                   | 5         | 5            | 3    | 8                | Fix                 | "Done" means Save; no complete action in the web panel                            |
| F-08 | Repeating tasks                | 4         | 3            | 3    | 1                | Keep                |                                                                                   |
| F-09 | Rescue the day                 | 3         | 3            | 1    | 0                | Keep                | One tap, guilt-free                                                               |
| F-10 | Inbox and upcoming             | 4         | 4            | 2    | 2                | Keep                |                                                                                   |
| F-11 | Someday                        | 2         | 2            | 1    | 1                | Keep                | Cheap; Monthly reads it                                                           |
| F-12 | Logbook                        | 2         | 2            | 1    | 0                | Keep                | Cheap                                                                             |
| F-13 | Day timeline                   | 3         | 3            | 3    | 1                | Keep                | Home of Plan my day                                                               |
| F-14 | Week planner                   | 3         | 3            | 3    | 0                | Keep                |                                                                                   |
| F-15 | Plan calendar                  | 2         | 2            | 3    | 0                | Simplify            | Week mode repeats F-14; bill rows inert                                           |
| F-16 | Eisenhower                     | 1         | 1            | 2    | 0                | Hide                | Off by default already; no evidence of use                                        |
| F-17 | Energy tags                    | 1         | 1            | 1    | 0                | Hide                | Off by default                                                                    |
| F-18 | Areas and projects             | 3         | 3            | 3    | 5                | Simplify            | Managed in 4 places; seeded with the owner's own jobs                             |
| F-19 | Habits                         | 4         | 4            | 3    | 4                | Keep                |                                                                                   |
| F-20 | Routines                       | 2         | 2            | 3    | 0                | Simplify            | Seeded Shutdown routine duplicates F-36                                           |
| F-21 | Focus timer                    | 3         | 3            | 3    | 1                | Keep                |                                                                                   |
| F-22 | Time tracking                  | 3         | 3            | 3    | 4                | Keep                | Survivor for F-23                                                                 |
| F-23 | Focus statistics               | 1         | 1            | 2    | 0                | Merge → F-22        | Subset of time data, own nav item                                                 |
| F-24 | Accounts                       | 4         | 4            | 2    | 2                | Automate            | New users have none, which blocks the first expense                               |
| F-25 | Transactions                   | 5         | 5            | 3    | 13               | Keep                | Hub; survivor for F-34                                                            |
| F-26 | Receipts                       | 3         | 2            | 3    | 1                | Fix                 | Photos outlive their transactions (privacy)                                       |
| F-27 | Categories and rules           | 4         | 4            | 2    | 2                | Keep                | Learning is already automatic                                                     |
| F-28 | Budgets                        | 5         | 4            | 3    | 4                | Simplify            | Set in 3 places; becomes the one place                                            |
| F-29 | Bills and income               | 4         | 4            | 3    | 4                | Keep                | Survivor for F-42                                                                 |
| F-30 | Savings goals                  | 3         | 3            | 2    | 1                | Fix                 | Monthly task is created by reading Today                                          |
| F-31 | Debts                          | 3         | 2            | 2    | 1                | Keep                | Common need (lending to family/friends) [Inferred]                                |
| F-32 | Events                         | 2         | 1            | 2    | 1                | Keep                | Already behind "More"; cheap                                                      |
| F-33 | Shopping list                  | 1         | 1            | 2    | 1                | Hide                | Off by default already                                                            |
| F-34 | Spending calendar              | 2         | 2            | 2    | 0                | Merge → F-25        | Month grid of the same transactions                                               |
| F-35 | Money overview                 | 4         | 5            | 2    | 0                | Keep                | Hub screen                                                                        |
| F-36 | Daily shutdown                 | 4         | 3            | 3    | 3                | Keep                | Feeds tomorrow's top three                                                        |
| F-37 | Weekly review                  | 3         | 3            | 3    | 2                | Fix                 | Three different prompt days; focus written but never shown                        |
| F-38 | Monthly review                 | 3         | 2            | 3    | 1                | Simplify            | Repeats Reports; keep only the "plan next month" job                              |
| F-39 | Reports                        | 3         | 2            | 3    | 0                | Keep                | Survivor for net worth, hourly rate, by area                                      |
| F-40 | Areas dashboard                | 1         | 1            | 2    | 0                | Merge → F-18        | Same numbers as Reports "By area"; links to the area page anyway                  |
| F-41 | Payday plan                    | 3         | 2            | 2    | 0                | Merge → F-28        | Writes budgets but lives in Review                                                |
| F-42 | Subscription spotter           | 2         | 1            | 2    | 0                | Merge → F-29        | Its output is a bill                                                              |
| F-43 | Streaks and mood               | 4         | 5            | 2    | 1                | Keep                | Serves the success metric                                                         |
| F-44 | Celebrations                   | 3         | 5            | 1    | 0                | Keep                | "Reward, never guilt"                                                             |
| F-45 | Tiki chat                      | 4         | 3            | 5    | 6                | Keep                | Highest cost (≈26% of API code), but capture-by-voice in Bangla fits the core job |
| F-46 | Tiki memory                    | 2         | 2            | 1    | 0                | Keep                | New, cheap                                                                        |
| F-47 | Briefing and suggestions       | 2         | 3            | 1    | 0                | Keep                | No AI cost                                                                        |
| F-48 | Reply feedback                 | 2         | 2            | 1    | 1                | Keep                | Only quality signal in the product                                                |
| F-49 | Voice input                    | 3         | 2            | 2    | 1                | Keep                |                                                                                   |
| F-50 | Plan my day (AI)               | 2         | 2            | 2    | 0                | Keep                |                                                                                   |
| F-51 | Break it down (AI)             | 2         | 2            | 1    | 0                | Keep                |                                                                                   |
| F-52 | Weekly coach (AI)              | 2         | 2            | 1    | 0                | Keep                | Inside F-37, optional                                                             |
| F-53 | AI budget suggestions          | 2         | 1            | 2    | 0                | Merge → F-38/F-28   | Second button for the same outcome as the rule-based one                          |
| F-54 | AI cost screen                 | 1         | 1            | 2    | 0                | Hide                | Settings only; owner view duplicates Admin                                        |
| F-55 | AI switches                    | 2         | 1            | 2    | 8                | Simplify            | 9 switches, one dead                                                              |
| F-56 | Reminders                      | 4         | 4            | 4    | 5                | Fix                 | 7-day horizon; context-free permission ask                                        |
| F-57 | Widget                         | 4         | 3            | 4    | 0                | Fix                 | Ignores Hide amounts                                                              |
| F-58 | App shortcuts                  | 2         | 2            | 1    | 0                | Keep                |                                                                                   |
| F-59 | App lock                       | 3         | 2            | 2    | 0                | Keep                |                                                                                   |
| F-60 | Hide amounts                   | 3         | 2            | 2    | 0                | Fix                 | Leaks in widget and bill notifications                                            |
| F-61 | Offline queue                  | 5         | 5            | 4    | all phone writes | Keep                | Rickshaw/shop-counter use                                                         |
| F-62 | Export                         | 2         | 1            | 1    | 1                | Required            | Privacy promise                                                                   |
| F-63 | Delete account                 | 2         | 1            | 2    | 0                | Required            | Privacy promise, Play policy                                                      |
| F-64 | Settings                       | 3         | 3            | 4    | —                | Simplify            | Phone entry hidden in Review; platforms differ                                    |
| F-65 | Appearance                     | 2         | 3            | 1    | 0                | Keep                |                                                                                   |
| F-66 | Workdays / days off / vacation | 3         | 2            | 2    | 3                | Merge (one control) | Two settings, one idea, inconsistent defaults                                     |
| F-67 | Cost in hours                  | 2         | 1            | 1    | 0                | Keep                | Already under "More"                                                              |
| F-68 | Palette and shortcuts          | 3         | 3            | 2    | 0                | Keep                | Desk speed                                                                        |
| F-69 | Web tour                       | 2         | 3            | 2    | 0                | Keep                |                                                                                   |
| F-70 | Owner admin                    | 3 (owner) | 1            | 3    | 0                | Keep                | Needed once others sign up                                                        |
| F-71 | Backups                        | 4         | —            | 2    | 0                | Required            | Data safety; privacy page wording                                                 |
| F-72 | AI cap                         | 3         | —            | 1    | 7                | Keep                | Cost control                                                                      |
| F-73 | `/ai/ask`                      | 0         | 0            | 1    | 0                | Remove              | No caller                                                                         |
| F-74 | Weekly recap endpoint          | 0         | 0            | 1    | 0                | Remove              | No caller                                                                         |
| F-75 | Time by area endpoint          | 0         | 0            | 1    | 0                | Remove              | No caller                                                                         |
| F-76 | Auto-categorise                | 0         | 0            | 2    | 0                | Remove              | Switch that does nothing; rules already learn                                     |
| F-77 | SMS import table               | 0         | 0            | 1    | 1 (export)       | Remove              | Dropped by decision                                                               |

### Verdict counts

| Verdict   | Count  | IDs                                                                                               |
| --------- | ------ | ------------------------------------------------------------------------------------------------- |
| Keep      | 40     | F-03, 05, 06, 08–14, 19, 21, 22, 25, 27, 29, 31, 32, 35, 36, 39, 43–52, 58, 59, 61, 65, 67–70, 72 |
| Simplify  | 8      | F-04, 15, 18, 20, 28, 38, 55, 64                                                                  |
| Merge     | 7      | F-23→22, F-34→25, F-40→18, F-41→28, F-42→29, F-53→38/28, F-66 (two settings→one)                  |
| Hide      | 4      | F-16, 17, 33, 54                                                                                  |
| Automate  | 1      | F-24                                                                                              |
| Fix       | 7      | F-07, 26, 30, 37, 56, 57, 60                                                                      |
| Required  | 5      | F-01, 02, 62, 63, 71                                                                              |
| Remove    | 5      | F-73–F-77                                                                                         |
| **Total** | **77** |                                                                                                   |

### Dependents check for every Remove and Merge

- F-73–F-75: 0 callers (grep, `02-inventory.md` Orphans). F-73's read tools are kept inside Tiki (`api/modules/ai/assistant/agent.ts:12`).
- F-76: removing drops one AI usage label in F-54/F-70 history; old usage rows keep their feature name — keep the label in the formatter only for history.
- F-77: only dependent is F-62 export; drop the table from the export list and add a migration.
- F-23: no dependents; F-22 already has the data (`/time-entries/focus-stats` stays as the source).
- F-34: no dependents; Transactions gains a month view.
- F-40: links to F-18; F-18 absorbs its three numbers. `/insights/areas` stays (it feeds the area page and F-39).
- F-41: writes F-28/F-30; moving the entry does not change the write path.
- F-42: writes F-29; F-38 links to it (re-point to Bills).
- F-53: gated by F-55/F-72; stays as an optional "refine with AI" inside the one suggestion step.
- F-66: `workdays` feeds recurrence parsing (`shared/quick-add-task.ts:41`), `daysOff` feeds day-off/streak logic (`api/modules/today/service.ts:147`); merging needs one source and a settings migration.
