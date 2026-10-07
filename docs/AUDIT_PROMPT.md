# Audit Prompt: QA, UX and Code Quality → 3 PDFs

Copy everything below the line and give it to the agent as a single message.
Optional: change the values in the **Config** block first.

---

You are a senior audit team made of three specialists working on the repository in the current workspace:

1. **QA Lead** – breaks things, finds functional bugs, edge cases and gaps in testing.
2. **UX Lead** – judges the product as its real user would, against the product's own stated goals.
3. **Staff Engineer** – reviews architecture, maintainability, security and performance.

Your job is to audit this project and produce **three separate, professional PDF reports**: `QA_Report.pdf`, `UX_Report.pdf` and `Code_Quality_Report.pdf`.

## Config

- Output folder: `docs/audit/<YYYY-MM-DD>/`
- Audience: the project owner (a developer). Be direct and specific.
- Depth: thorough. Read the real code; do not skim.
- Mode: **read-only.** Do NOT change any source files, configs, dependencies or git state. The only files you create are inside the output folder (plus temporary build files there, removed at the end).

## Ground rules (apply to all three reports)

- **Evidence or it didn't happen.** Every finding must cite at least one concrete location: `path/to/file.ts:L42-L58`, a screenshot, a command output or a reproduction step. No generic advice like "add more tests" unless you name exactly which module and which cases.
- **No invented facts.** If you could not run or verify something, say so and label the finding `Unverified`. Never make up test results, metrics or line numbers.
- **Judge against the project's own intent.** Before auditing, read the product/design/spec documents (e.g. `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/`, any spec PDF). Use their stated users, principles and requirements as the main yardstick, then general best practice second.
- **Severity scale (use the same one in all reports):**
  - `Critical` – data loss, security hole, crash, or a core flow that doesn't work.
  - `High` – a major feature broken or seriously degraded; a clear violation of a stated product principle.
  - `Medium` – a real problem with a workaround, or notable friction or tech debt.
  - `Low` – polish, consistency, minor cleanup.
- **Each finding uses this format:**
  - **ID** (`QA-001`, `UX-001`, `CQ-001`)
  - **Title** (one line)
  - **Severity** and **Category**
  - **Where** (file/line, screen, or endpoint)
  - **What's wrong** (what happens vs. what should happen)
  - **Evidence** (code snippet ≤ 15 lines, steps to reproduce, or screenshot)
  - **Why it matters** (impact on the user or the codebase)
  - **Recommendation** (concrete fix; a short code sketch when helpful)
  - **Effort** (`S` < 1h, `M` < 1 day, `L` > 1 day)
- Merge duplicates. Prefer 25 strong findings over 80 weak ones.
- Also note **what is done well** (briefly) so the owner knows what to keep.

## Phase 1 – Discovery (do this first and write down notes)

1. Map the repo: workspaces/packages, apps, entry points, routing, data layer, shared code, build and deploy setup.
2. Find the stack and tooling (package manifests, lint/format config, tsconfig, test runner, CI, deploy files).
3. Read all product, design and spec docs. Extract: target user, core flows, design principles, accessibility commitments and any explicit requirements. Turn these into a **checklist** you will audit against.
4. Run the project's existing automated checks **without fixing anything**, and save the raw output for the reports. For example: lint, typecheck, tests, and test coverage if it's available. Use the scripts defined in the project's package manifests. If a command fails or isn't available, record that as a finding. Don't install global tools.
5. Collect any existing screenshots or visual assets you can use for the UX review.

## Phase 2 – QA audit → `QA_Report.pdf`

Cover at least:

- **Requirements traceability:** a table mapping each requirement or core flow from the spec/docs to the code that implements it → status `Implemented / Partial / Missing / Broken`.
- **Functional correctness:** logic bugs, wrong calculations (especially money, dates, time zones, rounding, currency formatting), off-by-one errors, state that falls out of sync.
- **Edge cases:** empty, null and very large inputs; unicode/locale input (e.g. Bangla digits and text); negative numbers; duplicate submissions; concurrent edits; clock or time-zone changes; midnight and month rollovers; offline then back online; app killed mid-action.
- **API/back end:** input validation, error codes, auth on every protected route, idempotency, pagination, scheduled jobs, migrations, failure of third-party services (e.g. LLM/AI calls timing out or returning bad data).
- **Client:** loading, error and empty states; retry behaviour; persistence and cache invalidation; permissions denied (notifications, camera, biometrics); deep links; background/foreground transitions.
- **Test suite assessment:** what's tested and what isn't, test quality (do assertions actually check behaviour?), flaky patterns, coverage per module.
- **Recommended test plan:** a prioritised list of the missing test cases (unit / integration / e2e), written as `Given / When / Then`.
- **Manual smoke-test checklist** the owner can run on a real device in 15 minutes.

## Phase 3 – UX audit → `UX_Report.pdf`

Review the actual screens, components, copy, navigation and flows in the code (and screenshots when you have them). Cover at least:

- **Fit to product principles:** score each stated principle 1–5 with evidence.
- **Core task flows:** for each core flow (e.g. "log an expense", "add a task", "check safe-to-spend"), count taps/steps, note friction, dead ends and missing confirmation or undo. Compare against any stated target (e.g. "log in under 5 seconds").
- **Heuristic review** (Nielsen's 10 heuristics): visibility of status, matching the real world, user control, consistency, error prevention, recognition over recall, efficiency, minimalism, error recovery, help.
- **Visual design:** hierarchy, spacing, typography scale, colour meaning and consistency with the design system/tokens, dark mode parity, iconography.
- **Mobile ergonomics:** thumb reach, touch targets (≥ 48 dp), keyboard handling, safe areas, one-handed use, gestures, haptics.
- **Accessibility:** WCAG AA contrast (calculate real ratios from the colour tokens), screen-reader labels/roles, focus order, dynamic font scaling, reduce-motion support, colour never being the only signal.
- **Content & microcopy:** tone matches the brand voice, clarity, error messages, empty states, localisation and number/currency formatting.
- **Feedback & delight:** loading, success and celebration moments; how misses and errors are handled (does the UI shame or guilt the user?).
- **Top 10 quick wins** (high impact, low effort) and **3 bigger redesign suggestions**, each tied to findings.

## Phase 4 – Code quality audit → `Code_Quality_Report.pdf`

Cover at least:

- **Architecture:** module boundaries, separation of concerns, shared-package usage, dependency direction, type sharing between API and client, circular dependencies.
- **Readability & maintainability:** very large files/functions (list the top 10 by size or complexity), duplication, naming, dead code, TODO/FIXME inventory, magic numbers, comment quality.
- **Type safety:** `any` / `as` casts / `@ts-ignore` / non-null `!` usage (with counts and locations), strictness settings, runtime validation at trust boundaries.
- **Error handling:** swallowed errors, unhandled promises, inconsistent error shapes, logging.
- **Security:** secrets in the repo, authN/authZ, input sanitisation, SQL/query safety, CORS, rate limiting, token storage on the device, dependency vulnerabilities (run the package manager's audit command only if it works offline or without changes; otherwise mark `Unverified`).
- **Performance:** N+1 queries, missing indexes, unbounded queries, unnecessary re-renders, large lists without virtualisation, heavy work on the JS thread, bundle size, startup cost.
- **Data layer:** schema design, migrations, constraints, transactions, money stored as integers/decimals (never floats), time zone handling.
- **Tooling & DX:** lint/format/typecheck results (summarise the counts by rule), scripts, CI, README accuracy, env setup, reproducibility.
- **Dependencies:** outdated, unused or duplicated packages; version pinning.
- **Scorecard:** rate each area 1–10 with a one-line justification.
- **Refactoring roadmap:** ordered list of improvements grouped into *Now (this week)*, *Next (this month)*, *Later*.

## Structure of every PDF

1. **Cover page:** report title, project name, date, commit hash (`git rev-parse --short HEAD`), auditor role.
2. **Executive summary** (max 1 page): overall score out of 100, a 3–5 sentence verdict, severity counts table, top 5 issues to fix first.
3. **Scope & method:** what was reviewed, commands run, what could not be verified.
4. **Findings:** grouped by category, sorted by severity, in the finding format above.
5. **Strengths:** what is done well.
6. **Action plan:** a prioritised table – ID, title, severity, effort, suggested order.
7. **Appendix:** raw command output (trimmed), requirement checklist, file inventory.

## PDF production

- Write each report as clean, self-contained **HTML with embedded CSS** (print-friendly, A4, ~11pt body text, page numbers in the footer, page breaks before major sections, coloured severity badges, monospaced code blocks that wrap and don't overflow, tables with header rows that repeat across pages).
- Convert HTML → PDF using whatever is available locally, in this order: headless Chromium/Chrome (`--headless --print-to-pdf`) → Playwright → `wkhtmltopdf` → `weasyprint` → `pandoc`. Check which is installed before choosing. If you need a tool that isn't installed, ask before installing it.
- Embed screenshots as images where relevant (relative paths or base64).
- **Verify each PDF after generating it:** the file exists, isn't empty, has the expected page count, and text/tables/code aren't cut off (render a page or two to an image and look at them, if you can). Fix the layout and regenerate if needed.
- Keep the source `.html` files next to the PDFs. Delete any other temporary files.

## Final reply to me

When you're done, reply with:

- Links to the three PDFs.
- One table: report → overall score → Critical / High / Medium / Low counts.
- The single most important issue from each report, in one line each.
- Anything you couldn't verify, and why.
