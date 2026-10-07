# Round-4 discovery notes (2026-10-07, commit 801dd5f, branch fix/audit-2026-10-06)
- Same monorepo as before (see ../../2026-10-06/_raw/NOTES.md). 36 commits since round 3 (7e2bfeb) —
  list in commits-since-round-3.txt — made to fix the round-3 findings.
- Earlier reports (context only; judge independently):
  round 1 ../../2026-10-06/ (QA 58 / UX 64 / CQ 70)
  round 2 ../../2026-10-06-r2/ (70 / 83 / 72)
  round 3 ../../2026-10-07-r3/ (87 / 89 / 83)
- Commands run now (raw output here):
  - `bunx biome check .` → exit 0 (lint.txt)
  - `bun run typecheck` → 3 workspaces exit 0
  - `bun run test` → shared 247, mobile 291, api 236 pass, 0 fail
  - coverage per workspace in coverage-*.txt (read each package's figures from its own run; README › Notes)
  - `bun run audit` (scripts/audit.ts vs scripts/audit-allowlist.json) → no new advisories, exit 0
  - `bunx expo export --platform android` → bundles OK
- CI: .github/workflows/check.yml (check + audit against the allowlist).
- Device testing is NOT possible here: the only emulator image has no Google Play services and sign-in
  is Google-only. docs/screenshots predate all fixes and cannot be re-shot here.
- PDF tool: /usr/bin/google-chrome headless; CSS @page margin boxes for "Page X of Y"; --no-pdf-header-footer.
