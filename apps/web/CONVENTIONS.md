# Web app conventions

How `apps/web` is put together, for anyone porting a phone screen or adding a view.
Read `docs/WEB_PLAN.md` (the design brief), `DESIGN.md` and `PRODUCT.md` first.

## Porting a phone screen

The phone app (`apps/mobile/src`) is the spec. Read its screen, sheet and hooks before
writing the web one, and keep its behaviour and its wording (copy, empty states, Undo
messages, error labels). Change the layout for a wide screen, not the content.

- Pure modules (no `react-native`, no `expo-*`) may be copied as they are; adjust only
  comments that mention the phone. Prefer importing from `@tick-taka/shared`.
- Never import from `apps/mobile` at runtime (tests may, as `test/tokens.test.ts` does).
- Never change `apps/mobile`, `apps/api` or `packages/shared` from web work.

| Phone | Web |
|---|---|
| `Screen title=…` | a route file under `src/routes/_auth/_shell/` rendering `<PageHeader>` and sections in a `flex flex-col gap-7` column |
| `router.push("/task/<id>")` and other sheets | `useOpenPanel()("task:<id>")` from `lib/panel.ts`; new records use `"task:new"` plus a preset object |
| sheet screens (`app/task/[id].tsx`, `*-sheet.tsx`) | a panel component registered in `features/<area>/panels.ts`, built on `components/ui/panel.tsx` |
| `useOutbox()` / `send({...})` | `fire({...})` (fire and forget) or `await write({...})` (panel saves; throws after the toast) from `lib/write.ts` |
| `useRemove()` | `remove(path, name)` from `lib/write.ts` (Undo toast) |
| `notify(...)` from `lib/notify` | `notify(...)` from `lib/toast.ts` |
| `haptic.*` | nothing |
| `playSound`, `celebrate` | `lib/sounds.ts`, `components/ui/confetti.tsx` |
| `editTime()` (server clock) | leave `updatedAt` out; the server stamps the edit |
| `ListRow`, `Group` | `Row`, `RowMark`, `Group` from `components/ui/group.tsx` |
| `Card` | only for a hero (safe to spend, running timer): `rounded-3xl bg-card p-6` |
| `Text variant=…` | plain elements with `text-large-title`, `text-title`, `text-heading`, `text-body`, `text-callout`, `text-caption` |
| `tone="mint"` etc. on text | `text-mint-text`, `text-coral-text`, `text-sky-text`, `text-grape-text`, `text-mango-text`, `text-muted` |
| `Icon name="…"` (MaterialCommunityIcons) | the closest `lucide-react` icon, `aria-hidden`, size 16 to 20 |
| `SwipeRow` actions | a `Menu` on hover/focus at the row's end, plus `keyActions` on `Row` |
| `PickerField`, chips used as a picker | `Select` from `components/ui/select.tsx` |
| `DateField`, `pickDate` | `DateField`, `TimeField`, `splitInstant`, `joinInstant` from `components/ui/date-field.tsx` |
| `AmountKeypad` | a `TextField` with `inputMode="decimal"`; evaluate with `tryEvaluateExpression` / `expressionToMinor` from `@tick-taka/shared/calculator` |
| `useIsOnline` from `lib/connection` | `useIsOnline` from `lib/online.ts` |
| `useFocusEffect`, `AppState` | `useEffect`, `document.visibilitychange` |

## Layout

- Wide screens are the main target (1280 to 1920 px). Every signed-in view takes the
  full width beside the sidebar; never cap a page's width. Use two columns where the phone stacks two independent blocks
  (`grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` or a 3:2 split), one column
  for a single list. Everything must still work at 390 px.
- Grouped lists (`Group` + `Row`) instead of separate cards. A card only for a hero.
- Sections: `Section` with a `title` (17 bold) and optional `SectionAction`.
- Section gap 28 px (`gap-7`); inside a section 12 px.
- No side-stripe borders, no gradient text, no glass, no identical card grids, no modal
  where a panel or inline control works. No em dashes in copy.
- Colour means something: mango for the one primary action of a view, sky for time,
  mint and coral (with a sign) for money in and out, grape for habits. Text uses the
  `-text` tokens; bright tokens are for marks and fills.

## Data

- Queries: TanStack Query with the typed client, `unwrap(api.<route>.$get(...))` from
  `lib/api.ts`. Shared query hooks live in `lib/queries.ts`; an area's own hooks live in
  `features/<area>/queries.ts`. Use the phone's query keys: the first segment decides
  what refreshes after a write (`lib/invalidation.ts`).
- Writes refresh the right queries by themselves (`scheduleRefresh` in `lib/write.ts`).
  Optimistic updates are welcome where the phone has them (`lib/today-cache.ts`).
- Today's date and the user's zone: `useTodayDate()`, `useUserTime()` from
  `lib/use-today.ts`. Never `new Date()` for a local day.

## Interaction

- Every list row that opens something gets `dataKey="<kind>:<id>"` so J / K reach it,
  and `keyActions` for X (toggle), T (top three) and Delete where they make sense.
- Destructive actions use Undo toasts, not confirmation dialogs (deleting an account
  is the exception).
- Panels: title, fields, and the action pinned in the footer (`footer` prop). Set
  `dirty` when something typed would be lost. Saving shows `loading` on the button;
  a failure keeps the panel open (`write` throws after its toast).
- Loading: `ViewSkeleton` / `SkeletonRows`; failure: `ErrorState` with Retry; nothing
  yet: `EmptyState` with the phone's copy.

## Files

- Hard ceiling of 800 lines per source file; aim for under 300. Split along a real seam
  (a panel's field groups, a view's sections).
- Colocate: `features/<area>/<thing>.tsx`; route files stay thin and import from
  `features/`.
- Biome formats and lints (`bunx biome check --write apps/web`); TypeScript is strict
  (`bun run --filter @tick-taka/web typecheck`). Pure logic gets a `bun test` in `test/`.

## Checking a view

With the demo API and the dev server running (see `scripts/screenshots.ts`):

```
bun scripts/screenshots.ts --token "$(cat /tmp/tt-demo/demo-token)" --path /money/budgets
```

Look at the PNG it prints; it also lists failed requests and page errors.
