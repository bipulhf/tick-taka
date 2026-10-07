# Design

## Visual theme

Calm and polished: the structure of Things 3 and Todoist (one big bold title, list-first screens, lots of air, a single accent) with Copilot Money's clarity for money (one large number, progress rings). Light and dark are both first-class; the app follows the system by default and can be pinned to Light or Dark in Settings.

Scene: one-handed in daylight at a shop counter (light: warm paper) and in bed at night doing the shutdown (dark: warm charcoal, never pure black).

## Color

Strategy: **Restrained.** Tinted neutrals plus one accent used for the primary action only.

| Token | Light | Dark | Role |
|---|---|---|---|
| background | #FFF8EE | #16151C | Screen |
| surface (card) | #FFFFFF | #22202B | Grouped lists, hero card, sheets |
| ink | #23202B | #F4F1EA | Primary text |
| muted | #6B655F | #A09AA6 | Secondary text |
| line | #EEE5D8 | #34313F | Hairline separators |
| line-strong | #8F8475 | #7A748C | Input, outlined-button and switch-track boundaries |
| mango | #FFB547 | #FFC266 | Primary action, FAB, Tiki; never a selected state |
| on-mango | #23202B | #23202B | Text and icons on mango and every other semantic fill, always dark |
| sky | #5B8CFF | #7AA2FF | Time: tasks, focus, calendar |
| mint | #2EC4A0 | #4FD8B5 | Money in, under budget |
| coral | #FF7A6B | #FF9385 | Money out (soft, never alarm red) |
| grape | #A57BFF | #B996FF | Habits, streaks |
| mango-text | #8A5A00 | #FFC266 | Mango as text |
| sky-text | #2C5BCB | #7AA2FF | Sky as text (links, time labels) |
| mint-text | #11725D | #4FD8B5 | Mint as text (money in, safe to spend) |
| coral-text | #B23A2A | #FF9385 | Coral as text (money out, errors) |
| grape-text | #6E44D6 | #B996FF | Grape as text (habit counts) |
| mango-inverse | #FFB547 | #8A5A00 | Action text on an ink surface (snackbar Undo) |

Rules: semantic colours appear as small marks (dots, rings, amounts, icons), not as large fills. The bright tokens are for marks; whenever a semantic colour is used for words, it uses its `-text` token, which the `Text` component's tones do automatically. Text and icons on a semantic fill (a mango button, a swipe-tray action) are always on-mango. Selected chips use the ink colour inverted (ink fill, background-coloured text) so they read in both themes; mango is reserved for the one primary action per screen. Focus, timers and every planner card are sky (time); cards with no time yet are neutral. Habit rings are always grape and habits differ by emoji, not colour. Area colours are picked from named swatches (Blue, Indigo, Mango, Green, Coral, Purple) that are drawn through the theme tokens and announced by name.

Contrast (WCAG 2.x, checked by `apps/mobile/test/contrast.test.ts` against both themes and both accent themes):

- Every text token on background and on surface: at least 4.5:1. Light: ink 15.2 / 16.0, muted 5.45 / 5.75, sky-text 5.75 / 6.06, mint-text 5.55 / 5.85, coral-text 5.64 / 5.95, grape-text 5.75 / 6.07, mango-text 5.62 / 5.93. Dark: ink 16.1 / 14.2, muted 6.62 / 5.86, sky 7.29 / 6.44, mint 10.2 / 9.03, coral 8.43 / 7.46, grape 7.66 / 6.77, mango 11.4 / 10.1.
- on-mango on each fill: mango 9.10 / 10.0, sky 5.06 / 6.43, mint 7.25 / 9.00, coral 6.28 / 7.44, grape 5.24 / 6.76 (light / dark).
- Snackbar: mango-inverse on ink 9.10 (light), 5.25 (dark).
- line-strong (UI boundaries, 3:1): 3.48 on background and 3.67 on surface in light; 4.06 and 3.59 in dark.
- Marks that are the only cue to a state or value (an unchecked checkbox ring, a habit's progress arc, the money calendar's spend bar) use the `-text` token or line-strong, never the bright mark, so they keep 3:1 on every surface. The bright marks stay for fills and for marks that sit beside a label.
- The home-screen widget builds its colours from the same tokens (`features/widget/widget-colors.ts`) and is checked by the same test.

## Typography

Nunito everywhere (rounded, friendly). Tabular digits for every amount and timer. Amounts follow Settings › Numbers (Western or Bangla digits) on screen, on the keypad and on the widget; dates and times stay 0-9, and the setting's caption says so.

| Role | Size / line | Weight |
|---|---|---|
| Large title | 34 / 40 | ExtraBold |
| Hero number | 44 / 50 | ExtraBold |
| Title | 24 / 30 | ExtraBold |
| Heading | 20 / 26 | Bold |
| Body | 17 / 24 | Regular |
| Callout | 15 / 21 | Regular |
| Caption | 13 / 18 | SemiBold |

Section labels are 13 SemiBold sentence case in muted, not shouting uppercase.

Caption (13) is the smallest text; nothing goes below it except tab labels (12). Text follows the system font size. Only the hero number and tight chrome (tab labels, calendar cells, keypad keys, the focus clock, emoji in fixed circles) are capped at 1.3x; the hero also shrinks to fit one line. Containers that hold text use a minimum height, never a fixed one.

## Layout

- Screen padding 20; 28 between sections; 12 inside a group.
- Grouped lists (one rounded surface, rows separated by hairlines) instead of many separate cards. A card is used only for a hero (safe to spend, running timer).
- Rows are at least 60 dp tall with a leading icon or checkbox, a title, an optional subtitle and one trailing value or chevron.
- Month grids (7 columns) bleed 12 dp into the screen padding and drop the card's side padding, so each day is at least 48 dp wide on a 360 dp phone. Day cells touch, so they never take a hitSlop that would overlap a neighbour.
- Large title at the top of each tab; pushed screens get a back chevron beside the title.

## Components

- **Tab bar:** a floating capsule (64 dp tall) of 4 equal tabs, each an icon over its name, with the mango quick-add FAB (56 dp, dark plus icon) in the middle of the capsule. The open tab is marked by ink colour and a soft pill, never by growing. When Tiki's chat is available, its 64 dp round button sits beside the capsule on the left, so it never covers content; the FAB is then centred in the capsule rather than on the screen (about 36 dp right of centre on a 360 dp phone). This is a deliberate trade (6c724f6): one thumb-tap to Tiki from every tab is worth more than a FAB fixed at the exact centre, and the FAB still sits in the lower middle, inside the thumb's reach. The FAB keeps its place within the capsule, so it moves only if the server's AI is switched on or off. Icons 26, labels 12 (the one size below Caption, allowed for tab labels only, capped at 1.3x font scale).
- **Buttons:** 52 dp tall, radius 16. Primary = mango with on-mango text; secondary = surface with a line-strong border (the hairline `line` is only 1.25:1, too faint for a control's edge); time = the secondary outline with a sky icon; ghost = text only.
- **Chips:** 40 dp, radius full, neutral by default; selected = ink fill. A chip is an action, one choice of a row (radio) or one of several (checkbox), never an on/off setting.
- **Switches:** every on/off setting is a labelled switch row (`ToggleRow`), and the whole row is the target, read once by screen readers as a switch with its state. On = ink track with a background-coloured thumb (like a selected chip); off = line-strong track. Both keep 3:1 on every surface (tested); a mint track would be 2.21:1 and means money in. A switch that sits inside a row which already names it (a budget line's rollover) is the same `Toggle`, never a hand-coloured one.
- **Pickers in sheets:** a compact "Cash ▾" style field that expands into a list (or an emoji grid), instead of rows of chips. A value set elsewhere that isn't a preset is listed as itself. Dates and times use a field of the same shape that opens the system dialog ("Next due / Mon 5 Oct").
- **Sheets:** creating and editing always happen in bottom sheets with the action pinned at the bottom.
- **Home-screen widget:** every pill is a 48 dp target with 13 dp labels, so the widget trades breadth for reach (`features/widget/widget-layout.ts`, tested). At the default 4×2 size one row of pills holds Task, Expense and up to two one-tap quick-logs; Focus and Tiki give way, because a quick-log is the fastest path the app has. A tall widget (240 dp or more) gives the quick-logs a row of their own and shows all four actions. Tiki is only offered when the server's AI is set up and the chat is on, as in the tab bar, so the widget never opens a chat that can only say it isn't available. After a quick-log, Undo and Keep take the row's first places for ten minutes at every size. A label is only shown when it fits, measured with the 8 dp of padding a row pill really has. Names come first: the second quick-log gives way before Task and Expense lose their names, so a wider widget never shows fewer of them. Only on the narrowest widget do the actions become glyphs (✓ －, never ＋ beside －, which would read as income and expense) with their full names for screen readers, and a quick-log that doesn't fit is left out rather than cut off.

## Motion

Springs for check-offs and number count-ups; 150–250 ms for state changes; nothing decorative; reduce-motion respected.
