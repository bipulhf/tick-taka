import { describe, expect, test } from "bun:test";
import { sourceFiles } from "./helpers/source-files";

const sources = sourceFiles(/\.tsx$/);

/**
 * Components that define a tone vocabulary (a map from tone name to classes, or a
 * tone type). They name every colour; the screens that pick one are what's checked.
 */
const VOCABULARY = [
  "components/ui/checkbox.tsx",
  "components/ui/chip.tsx",
  "components/ui/list-row.tsx",
  "components/ui/progress-bar.tsx",
  "components/ui/shortcut-row.tsx",
  "components/ui/swipe-row.tsx",
  "components/ui/text.tsx",
  "features/plan/compact-task.tsx",
];

/**
 * DESIGN.md: purple is for habits, and mango only for the one primary action. Purple
 * marks are allowed in habit code and on habit rows elsewhere (named here); a new
 * use needs a deliberate entry.
 */
const GRAPE_OK = [
  "features/habits/",
  "features/review/shutdown-flow.tsx", // the shutdown's habit checkboxes
  "features/review/weekly-review.tsx", // the review's habit step
  "features/plan/plan-home.tsx", // the Habits tile
  "app/login.tsx", // the Habits feature line
];

/** Mango is the primary action: the FAB, primary buttons, a draft's Save, and Tiki. */
const MANGO_OK = [
  "components/navigation/tab-bar.tsx", // the quick-add FAB
  "components/ui/button.tsx", // the primary button
  "features/app/error-screen.tsx", // the error screen's primary button (no theme there)
  "features/assistant/draft-card.tsx", // a draft's Save
  "features/assistant/chat-composer.tsx", // Tiki's send button
  "features/assistant/thinking-indicator.tsx", // Tiki's typing caret
  "features/quick-add/quick-add-sheet.tsx", // Tiki reading the quick-add text
  "app/login.tsx", // Tiki's halo
  "app/_layout.tsx", // the navigation theme's primary
  "components/ui/screen.tsx", // the pull-to-refresh spinner
];

/**
 * Every way a colour reaches the screen: a class (bg-grape, text-grape/50,
 * border-mango), a palette value (colors.grape, as a chart's frontColor or a
 * spinner's color) or a tone string, including inside a ternary.
 */
function uses(name: "grape" | "mango"): RegExp {
  return new RegExp(
    `\\b(?:bg|text|border|fill|stroke)-${name}\\b(?!-)|colors\\.${name}\\b|"${name}"`,
  );
}

function offenders(name: "grape" | "mango", allowed: string[]): string[] {
  const pattern = uses(name);
  return sources
    .filter(({ path }) => !VOCABULARY.includes(path))
    .filter(({ path }) => !allowed.some((ok) => path.startsWith(ok)))
    .filter(({ text }) => pattern.test(text))
    .map(({ path }) => path);
}

describe("colour meaning", () => {
  test("the patterns catch every form a colour takes", () => {
    const grape = uses("grape");
    for (const form of [
      'className="bg-grape"',
      'className="h-2 bg-grape/30"',
      'className={on ? "text-grape" : ""}',
      "frontColor: colors.grape,",
      '<ProgressBar tone={over ? "coral" : "grape"} />',
      'iconColor="grape"',
      "stroke={colors.grape}",
    ])
      expect(grape.test(form)).toBe(true);
    for (const form of ["text-grape-text", "colors.grapeText", '"grape-dusk"'])
      expect(grape.test(form)).toBe(false);
    expect(uses("mango").test('"÷×−+".includes(key) ? "bg-mango/30" : "bg-card"')).toBe(true);
    expect(uses("mango").test('tone="mangoOnInk"')).toBe(false);
  });

  test("purple marks appear only for habits", () => {
    expect(offenders("grape", GRAPE_OK)).toEqual([]);
  });

  test("mango appears only on the primary action and Tiki", () => {
    expect(offenders("mango", MANGO_OK)).toEqual([]);
  });

  test("every switch is the shared one (ink when on), never a hand-coloured track", () => {
    const own = sources
      .filter(({ path }) => path !== "components/ui/toggle-row.tsx")
      .filter(({ text }) => /<Switch\b|trackColor/.test(text));
    expect(own.map(({ path }) => path)).toEqual([]);
  });

  test("list rows never use mango as an icon colour", () => {
    const rows = sources.filter(({ text }) => /iconColor=["{]*"mango"/.test(text));
    expect(rows.map(({ path }) => path)).toEqual([]);
  });
});
