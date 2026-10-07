import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blend, widgetColors } from "../src/features/widget/widget-colors";
import {
  ON_ACCENT,
  type Palette,
  palette,
  rewardThemes,
  SOLE_CUE_MARKS,
  SWITCH_TRACK,
  themedPalette,
} from "../src/theme/palette";

/** WCAG 2.x relative luminance contrast ratio. */
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A translucent fill such as bg-sky/15, flattened onto what sits under it. */
function over(fill: string, base: string, alpha: number) {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(channel(fill, i) * alpha + channel(base, i) * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const TEXT_AA = 4.5;
const UI_AA = 3;
const SCHEMES = ["light", "dark"] as const;
const THEMES = [null, ...Object.keys(rewardThemes)];
const MARKS = ["mango", "sky", "mint", "coral", "grape"] as const;
/** Every colour the Text component uses for words on the screen or a card. */
const TEXT_TOKENS = [
  "ink",
  "muted",
  "mangoText",
  "skyText",
  "mintText",
  "coralText",
  "grapeText",
] as const;
const TINTED = {
  sky: "skyText",
  mint: "mintText",
  coral: "coralText",
  grape: "grapeText",
} as const;

/** Every surface combination: both schemes, with and without an accent theme. */
const variants = SCHEMES.flatMap((scheme) =>
  THEMES.map((theme) => ({
    name: `${scheme}${theme ? ` / ${theme}` : ""}`,
    colors: themedPalette(scheme, theme),
  })),
);

describe("global.css matches the palette", () => {
  const css = readFileSync(join(import.meta.dir, "../src/global.css"), "utf8");
  const [light, dark] = css.split("@media (prefers-color-scheme: dark)") as [string, string];
  const parse = (block: string) =>
    Object.fromEntries(
      [...block.matchAll(/--([a-z-]+):\s*(\d+) (\d+) (\d+);/g)].map((m) => [
        m[1]!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
        `#${[m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`.toUpperCase(),
      ]),
    );
  for (const [scheme, block] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    test(scheme, () => {
      expect(parse(block)).toEqual({ ...palette[scheme] });
    });
  }
});

describe("text reaches WCAG AA (4.5:1)", () => {
  for (const { name, colors } of variants) {
    test(`${name}: text tokens on background and cards`, () => {
      for (const token of TEXT_TOKENS) {
        for (const surface of ["background", "card"] as const) {
          expect({
            pair: `${token} on ${surface}`,
            ok: contrast(colors[token], colors[surface]) >= TEXT_AA,
          }).toEqual({ pair: `${token} on ${surface}`, ok: true });
        }
      }
    });

    test(`${name}: semantic text on its own 15% tint`, () => {
      for (const [mark, text] of Object.entries(TINTED) as [keyof typeof TINTED, keyof Palette][]) {
        for (const surface of ["background", "card"] as const) {
          const tint = over(colors[mark], colors[surface], 0.15);
          expect({
            pair: `${text} on ${mark}/15 over ${surface}`,
            ok: contrast(colors[text], tint) >= TEXT_AA,
          }).toEqual({ pair: `${text} on ${mark}/15 over ${surface}`, ok: true });
        }
      }
    });

    test(`${name}: muted on the segmented control track`, () => {
      const track = over(colors.line, colors.background, 0.6);
      expect(contrast(colors.muted, track)).toBeGreaterThanOrEqual(TEXT_AA);
    });
  }

  for (const scheme of SCHEMES) {
    const colors = palette[scheme];
    test(`${scheme}: dark on-accent text on every semantic fill`, () => {
      for (const mark of MARKS) {
        expect({ mark, ok: contrast(ON_ACCENT, colors[mark]) >= TEXT_AA }).toEqual({
          mark,
          ok: true,
        });
      }
    });

    test(`${scheme}: inverted ink surfaces (selected chip, snackbar)`, () => {
      expect(contrast(colors.background, colors.ink)).toBeGreaterThanOrEqual(TEXT_AA);
      expect(contrast(colors.mangoInverse, colors.ink)).toBeGreaterThanOrEqual(TEXT_AA);
    });
  }
});

describe("component boundaries reach 3:1", () => {
  for (const { name, colors } of variants) {
    test(`${name}: line-strong on background and cards`, () => {
      expect(contrast(colors.lineStrong, colors.background)).toBeGreaterThanOrEqual(UI_AA);
      expect(contrast(colors.lineStrong, colors.card)).toBeGreaterThanOrEqual(UI_AA);
    });

    test(`${name}: marks that are the only cue (rings, arcs, spend bars)`, () => {
      for (const token of SOLE_CUE_MARKS) {
        for (const surface of ["background", "card"] as const) {
          expect({
            pair: `${token} on ${surface}`,
            ok: contrast(colors[token], colors[surface]) >= UI_AA,
          }).toEqual({ pair: `${token} on ${surface}`, ok: true });
        }
      }
    });
  }

  for (const { name, colors } of variants) {
    test(`${name}: switch tracks, on and off, on background and cards`, () => {
      for (const state of ["on", "off"] as const) {
        for (const surface of ["background", "card"] as const) {
          const pair = `${state} track (${SWITCH_TRACK[state]}) on ${surface}`;
          expect({
            pair,
            ok: contrast(colors[SWITCH_TRACK[state]], colors[surface]) >= UI_AA,
          }).toEqual({ pair, ok: true });
        }
      }
    });
  }

  test("the bright light-mode marks are why sole cues use the -text tier", () => {
    // Fine as fills under dark text, too faint alone: an unchecked mint ring was 2.21:1.
    expect(contrast(palette.light.mint, palette.light.card)).toBeLessThan(UI_AA);
    expect(contrast(palette.light.coral, palette.light.card)).toBeLessThan(UI_AA);
  });
});

describe("home-screen widget reaches WCAG AA", () => {
  for (const scheme of SCHEMES) {
    const c = widgetColors(scheme);
    const check = (pairs: [string, string, string][]) => {
      for (const [pair, fg, bg] of pairs) {
        expect({ pair, ok: contrast(fg, bg) >= TEXT_AA }).toEqual({ pair, ok: true });
      }
    };
    test(`${scheme}: labels and amounts on both ends of the gradient`, () => {
      for (const end of ["from", "to"] as const) {
        check([
          [`muted on ${end}`, c.muted, c[end]],
          [`mint-text hero on ${end}`, c.mintText, c[end]],
          [`coral-text hero on ${end}`, c.coralText, c[end]],
        ]);
      }
    });
    test(`${scheme}: next-up card, quick-log and Undo buttons`, () => {
      check([
        ["ink on card", c.ink, c.card],
        ["muted on card", c.muted, c.card],
        ["sky-text on card", c.skyText, c.card],
      ]);
    });
    test(`${scheme}: action pill labels on their tints`, () => {
      check([
        ["sky-text on sky tint", c.skyText, c.skyTint],
        ["coral-text on coral tint", c.coralText, c.coralTint],
      ]);
    });
  }

  test("blend() flattens like the in-app tints", () => {
    const expected: string = over("#5B8CFF", "#FFFFFF", 0.15).toUpperCase();
    expect<string>(blend("#5B8CFF", "#FFFFFF", 0.15)).toBe(expected);
  });
});

test("contrast() matches known WCAG values", () => {
  expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  expect(contrast("#7D7670", "#FFFFFF")).toBeCloseTo(4.47, 2);
});

test("accent themes reach the JS palette (useColors), not only the CSS variables", () => {
  expect(themedPalette("light", "mint-breeze").background).toBe("#ECFAF5");
  expect(themedPalette("dark", "grape-dusk").card).toBe("#241E34");
  expect(themedPalette("light", "mint-breeze").ink).toBe(palette.light.ink);
  expect(themedPalette("light", null)).toBe(palette.light);
  expect(themedPalette("dark", "no-such-theme")).toBe(palette.dark);
});
