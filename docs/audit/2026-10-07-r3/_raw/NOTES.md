# Round-3 discovery notes (2026-10-07, commit 7e2bfeb, branch fix/audit-2026-10-06)
- Same monorepo as before (see ../../2026-10-06/_raw/NOTES.md). 117 commits since round 1 (3b5438b);
  42 since round 2 (df29d67) — list in commits-since-round-2.txt — made to fix the round-2 findings.
- Earlier reports (context only; judge independently):
  round 1 ../../2026-10-06/{QA,UX,Code_Quality}_Report.html (58 / 64 / 70)
  round 2 ../../2026-10-06-r2/{QA,UX,Code_Quality}_Report.html (70 / 83 / 72)
- Commands run now (raw output here):
  - `bunx biome check .` → 523 files, exit 0 (lint.txt). docs/audit is excluded in biome.json.
  - `bun run typecheck` → 3 workspaces exit 0
  - `bun run test` → shared 247, mobile 233, api 209 pass, 0 fail
  - coverage per workspace in coverage-*.txt (Bun 1.3 mis-maps lines of files imported across
    workspaces; read each package's numbers from its own run — README › Notes on decisions)
  - `bun audit` → 5 advisories (audit.txt); uuid is patched by an override; the rest are
    documented as accepted in README › Notes on decisions
  - `bunx expo export --platform android` → bundles OK (android-export.txt)
- CI: .github/workflows/check.yml.
- Device testing is NOT possible here: the only emulator image has no Google Play services and
  sign-in is Google-only. docs/screenshots predate all fixes (cannot be re-shot here).
- PDF tool: /usr/bin/google-chrome headless; use CSS @page margin boxes for "Page X of Y" and
  --no-pdf-header-footer.
