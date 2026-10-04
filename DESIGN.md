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
| muted | #7D7670 | #A09AA6 | Secondary text |
| line | #EEE5D8 | #34313F | Separators, borders |
| mango | #FFB547 | #FFC266 | Primary action, FAB, selected state |
| on-mango | #23202B | #23202B | Text and icons on mango, always dark |
| sky | #5B8CFF | #7AA2FF | Time: tasks, focus, calendar |
| mint | #2EC4A0 | #4FD8B5 | Money in, under budget |
| coral | #FF7A6B | #FF9385 | Money out (soft, never alarm red) |
| grape | #A57BFF | #B996FF | Habits, streaks |

Rules: semantic colours appear as small marks (dots, rings, amounts, icons), not as large fills. Selected chips use the ink colour inverted (ink fill, background-coloured text) so they read in both themes; mango is reserved for the one primary action per screen.

## Typography

Nunito everywhere (rounded, friendly). Tabular digits for every amount and timer.

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

## Layout

- Screen padding 20; 28 between sections; 12 inside a group.
- Grouped lists (one rounded surface, rows separated by hairlines) instead of many separate cards. A card is used only for a hero (safe to spend, running timer).
- Rows are at least 60 dp tall with a leading icon or checkbox, a title, an optional subtitle and one trailing value or chevron.
- Large title at the top of each tab; pushed screens get a back chevron beside the title.

## Components

- **Tab bar:** 4 tabs plus a centre mango FAB (64 dp, dark plus icon). Icons 26, labels 12.
- **Buttons:** 52 dp tall, radius 16. Primary = mango with on-mango text; secondary = surface with hairline border; ghost = text only.
- **Chips:** 40 dp, radius full, neutral by default; selected = ink fill.
- **Pickers in sheets:** a compact "Cash ▾" style field that expands into a list, instead of rows of chips.
- **Sheets:** creating and editing always happen in bottom sheets with the action pinned at the bottom.

## Motion

Springs for check-offs and number count-ups; 150–250 ms for state changes; nothing decorative; reduce-motion respected.
