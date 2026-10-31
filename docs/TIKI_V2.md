# Tiki, round two: a better assistant on web and phone

Ten improvements, agreed 31 Oct 2026. This is the contract between the API and both
apps; each section says what the server does and what the apps show.

## 1. Tiki knows what's on screen

- `POST /ai/assistant` accepts an optional `screen`:
  `{ view: string (≤ 120, the route, e.g. "/money/transactions"), record?: { kind, id } }`
  where `kind` is one of `task, transaction, habit, goal, debt, account, event, project,
  recurring, time_entry, routine` and `id` is a ULID.
- The server looks the record up itself (the user's own data, through the app's routes)
  and adds one line to the system context: `The user is looking at the <kind>
  “<title>” (id <id>) on <view>. "this", "it" and "here" mean that record.` A record that
  isn't found is ignored.
- As built: `<kind>` is the name the tools use (a `recurring` is a `bill`), so the model
  can act on it. A debt is named by its direction ("money you owe"), never by the
  person, as `find` does. With no record, or one that isn't found, the line is just
  `The user is on <view>.` The view is cut to one line. Shared:
  `assistantScreenSchema`, `ASSISTANT_RECORD_KINDS` in `@tick-taka/shared/schemas/ai`.
- Apps send it with every message: the web from the route and the open panel
  (`?panel=task:<id>`), the phone from the current screen and its sheet params.

## 2. Suggestions that fit the moment

- `@tick-taka/shared/tiki-suggestions` exports `suggestionsFor(input)` → up to 4 short
  prompts. Input: `{ view, hour, overdue, inbox, topThreeLeft, billsDueSoon,
  hasAccounts, hasBudgets }`. Mixes Bangla and English like today's fixed list; e.g.
  Money views ask about spending, evenings offer "Close my day", overdue tasks offer to
  move them, an empty account offers setup. Pure and tested.
- Both apps show them as chips in an empty chat and under the briefing.

## 3. Answers you can click

- `done` gains `cards: Card[]`:
  - `{ type: "record", kind, id, title, subtitle? }` for records Tiki created, changed,
    or found and named in its reply (at most 6);
  - `{ type: "total", label, amountMinor?, minutes?, count? }` from report tools (at
    most 3).
- Apps render record cards as small rows that open the record (web panel / phone
  sheet) and totals as a compact number card. Cards are stored with the message (§8).
- As built: the type is `AssistantCard` in `@tick-taka/shared/schemas/ai`. `kind` uses
  the §1 kinds. Changed records come first (creates, updates, and logged habits, paid
  bills and goal contributions), then found records whose title appears in the reply
  (titles of 3+ characters). Drafts and pending deletions make no cards. `subtitle` is
  a short amount and/or day, e.g. "৳120, Sun 4 Oct". Totals: "Spent, 1 Oct to 31 Oct"
  and "Income, …" (`amountMinor`), "Tracked, …" (`minutes`), "Tasks finished, …"
  (`count`), "All accounts" (BDT only), "Left in budgets, 2026-10", "Owed to you" and
  "You owe"; the latest 3 win. `done.cards` is always present (maybe empty).

## 4. "Remember this"

- Settings gain `tikiNotes: string[]` (≤ 30 notes, each ≤ 200 characters, default `[]`).
- Two assistant tools: `remember { note }` and `forget { note }` (matches by text).
  Each is an action with Undo (a PATCH of the previous list).
- As built: action summaries are `Remembered “…”` / `Forgot “…”`; the Undo is
  `PATCH /settings { tikiNotes: <previous list> }`. `forget` takes an exact match
  (ignoring case), else the one note containing the text; when several contain it,
  Tiki asks which. Remembering a note already kept does nothing. `update_settings`
  can't change `tikiNotes`.
- The system prompt lists the notes under "What the user asked you to remember".
- Settings › Tiki and AI (both apps): "What Tiki remembers": the list, delete one, add one.

## 5. A short briefing when you open the chat

- `@tick-taka/shared/tiki-briefing` exports `briefingFor(input)` → `{ greeting, lines:
  string[] }` from numbers the apps already have on Today: tasks left today, top three
  left, safe to spend (minor units, or null with no budgets), bills or paydays due
  today/tomorrow (names), habits left. Calm, no guilt; never more than 3 lines.
- Shown at the top of a new or empty chat. No AI call, no cost.
- As built: input `{ hour, tasksLeft, topThreeLeft, safeToSpendMinor: number | null,
  due: { name, kind: "bill" | "income", day: "today" | "tomorrow" }[], habitsLeft,
  currency?, numerals? }`. Lines in order: tasks, money, what's due, habits (habits
  only when there is room).

## 6. Ask from anywhere

- Web: in the Ctrl K palette, typed text offers "Ask Tiki: <text>" (Enter opens the
  chat and sends it). Task and transaction row menus get "Ask Tiki about this" (opens
  the chat with that record as `screen.record` and the composer focused).
- Phone: task and transaction sheets get an "Ask Tiki" button doing the same.

## 7. Faster and cheaper

- Server only. A turn whose last user message is short (≤ 80 characters), has no "?",
  and has no history of tool errors starts on the `fast` model; it moves to `smart`
  for the rest of the turn after a failed tool call or a second round. Everything else
  uses `smart`. Usage is logged with the model actually used.
- As built: at most the first two model calls of a turn are `fast`; the third and
  later, and any call after a failed tool call, are `smart`. "History of tool errors"
  means an earlier reply's memo ends in `a step failed`, which the server adds to the
  memo of any turn where a tool call failed.

## 8. Chats on every device

- New tables in the user's own database (migration `0007`): `assistant_threads (id,
  title, created_at, updated_at, deleted_at)` and `assistant_messages (id, thread_id,
  role, content, memo, cards json, actions json, rating, created_at)`.
- `POST /ai/assistant` accepts `threadId` (a ULID the app makes). With it, the server
  upserts the thread (title from the first user message, ≤ 60 characters), stores the
  user's message and, when the turn ends, the reply with its memo, cards and action
  summaries. `done` gains `threadId` and `messageId` (the stored reply's id).
- Routes: `GET /ai/threads` (newest first: id, title, updatedAt, messageCount),
  `GET /ai/threads/:id` (with messages), `PATCH /ai/threads/:id { title }`,
  `DELETE /ai/threads/:id` (soft, restorable via `POST /ai/threads/:id/restore`).
- Apps: a chat list (new chat, switch, rename, delete with Undo); the current thread
  id persists; opening a thread loads its messages. The phone keeps its local copy for
  offline use and refreshes from the server when online.
- Privacy policy: chats are kept in the user's own space on the server and can be
  deleted at any time.
- As built: list items are `{ id, title, createdAt, updatedAt, deletedAt, messageCount }`
  (at most 200). `GET /ai/threads/:id` is that plus `messages` (oldest first, the latest
  500): `{ id, role, content, memo, cards, actions: { summary }[], rating, createdAt }`.
  PATCH takes a title of 1 to 60 characters. DELETE and restore return the summary; a
  deleted chat answers 404 on GET and PATCH. Each turn stores only its last user
  message (the app sends the history, the server doesn't re-store it); sending a
  message to a deleted chat brings it back. A turn that errors or is cancelled stores
  no reply. Chats aren't in `/sync`; they are in the JSON export.

## 9. A check before big changes

- Prompt rule: before changing more than 5 records in one request, Tiki states the plan
  in one sentence ("I'll move 7 tasks to Friday.") and asks to go ahead, and acts only
  after the user agrees. Deletions and money drafts already wait for a tap.

## 10. Thumbs up or down

- `POST /ai/feedback { messageId, rating: "up" | "down", comment? (≤ 500) }`; stored on
  the message (rating) and, for the owner's view, as a row in `users.db`
  (`ai_feedback: user_id, message_id, rating, comment, created_at`; no reply text).
  One row per reply: rating it again replaces the earlier one. Answers
  `{ messageId, rating }`, or 404 when the id isn't one of the user's stored replies.
  The rows go when the account is deleted.
- `GET /admin/feedback?month=` (owner only): counts up / down and the latest comments
  with the user's email: `{ month, up, down, comments: { email, rating, comment,
  createdAt }[] }` (at most 50, newest first; the owner's time zone decides the month).
- Apps: thumbs under each stored reply; down offers an optional one-line comment.
  Web admin › AI cost shows the feedback summary.
