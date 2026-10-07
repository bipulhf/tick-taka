# Fix contract (shared between parallel fix agents)

Reports with full finding detail (read the finding you own before fixing it):
- /media/bipulhf/Drive2/mehedi_bhai_projects/tick_taka/docs/audit/2026-10-06/QA_Report.html
- /media/bipulhf/Drive2/mehedi_bhai_projects/tick_taka/docs/audit/2026-10-06/UX_Report.html
- /media/bipulhf/Drive2/mehedi_bhai_projects/tick_taka/docs/audit/2026-10-06/Code_Quality_Report.html

## Sessions (server: api-platform agent; client: mobile-offline agent)

- Login `POST /auth/google` keeps its response shape: `{ token, expiresAt (ms epoch), user, created }`.
- JWT gains a `jti` (session id). users.db gets a `sessions` table
  (id = jti, user_id, created_at, last_used_at, expires_at, revoked_at). requireAuth rejects
  revoked/unknown sessions with 401.
- Token TTL stays 30 days but is **sliding**: `POST /auth/refresh` (Bearer auth) returns the same
  shape as login `{ token, expiresAt, user }` with a new jti and revokes the old one.
- `POST /auth/logout` (Bearer auth) revokes the current session, returns 204.
- `DELETE /auth/account` (Bearer auth) deletes the user, their sessions, their database files,
  uploads and backups; returns 204.
- 401 error bodies use `error.code`: `session_expired` (expired/revoked token) or `unauthorized`
  (missing/invalid). Error body shape unchanged: `{ error: { code, message, details? } }`.
- Client: a 401 must NEVER clear the offline queue. It marks the session as expired, pauses the
  outbox, and shows a re-sign-in prompt. If the same user id signs back in, the queue resumes.
  If a different user signs in, then (and only then) the previous user's data is wiped.
  "Sign out" with pending writes asks for confirmation first, stating how many changes are unsynced.
- Client refreshes the token on start and on foreground when it is older than 24 hours.

## Receipt images

- Server stops accepting `?token=` on `/uploads/*`; Bearer header only.
- Client loads receipt images with expo-image `source={{ uri, headers: { authorization: "Bearer …" } }}`.

## Rules for every fix agent

- Read the real code before editing. Focused changes only; no unrelated refactors.
- Hard ceiling 800 lines per source file. No barrel index files.
- Add/extend tests for every behaviour you fix (bun test). Run typecheck, `bunx biome check .`
  and tests for the workspaces you touched before each commit; all must pass.
- Commit per logical change, Conventional Commits (feat/fix/refactor/test/chore/docs/perf/build/ci),
  message references finding IDs in the body. NO co-author lines, never mention an AI/agent.
- Never hand-edit bun.lock. Adding a dependency is allowed only if no reasonable alternative
  exists; use `bun add` and say why in the commit.
- If a finding is wrong (the code does not behave as described), don't change code; explain why
  in your final reply.
