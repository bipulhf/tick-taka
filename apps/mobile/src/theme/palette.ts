/**
 * Raw colour tokens, kept free of React Native imports so tests can check them.
 * global.css holds the same values as CSS variables; test/contrast.test.ts keeps both in step.
 *
 * Two tiers per semantic colour: the bright mark (dots, rings, bars, icons, fills) and a
 * "-text" variant that reaches WCAG AA (4.5:1) as text on the background and on cards.
 */
type PaletteShape = Record<
  | "mango"
  | "sky"
  | "mint"
  | "coral"
  | "grape"
  | "mangoText"
  | "skyText"
  | "mintText"
  | "coralText"
  | "grapeText"
  /** Mango action text on an ink (inverted) surface, such as the snackbar. */
  | "mangoInverse"
  | "background"
  | "card"
  | "ink"
  | "muted"
  | "line"
  /** Boundaries of inputs and outlined buttons: at least 3:1 against the surface. */
  | "lineStrong",
  string
>;

export const palette: { light: PaletteShape; dark: PaletteShape } = {
  light: {
    mango: "#FFB547",
    sky: "#5B8CFF",
    mint: "#2EC4A0",
    coral: "#FF7A6B",
    grape: "#A57BFF",
    mangoText: "#8A5A00",
    skyText: "#2C5BCB",
    mintText: "#11725D",
    coralText: "#B23A2A",
    grapeText: "#6E44D6",
    mangoInverse: "#FFB547",
    background: "#FFF8EE",
    card: "#FFFFFF",
    ink: "#23202B",
    muted: "#6B655F",
    line: "#EEE5D8",
    lineStrong: "#8F8475",
  },
  dark: {
    mango: "#FFC266",
    sky: "#7AA2FF",
    mint: "#4FD8B5",
    coral: "#FF9385",
    grape: "#B996FF",
    mangoText: "#FFC266",
    skyText: "#7AA2FF",
    mintText: "#4FD8B5",
    coralText: "#FF9385",
    grapeText: "#B996FF",
    mangoInverse: "#8A5A00",
    background: "#16151C",
    card: "#22202B",
    ink: "#F4F1EA",
    muted: "#A09AA6",
    line: "#34313F",
    lineStrong: "#7A748C",
  },
};

export type Palette = PaletteShape;
export type ColorName = keyof Palette;

/**
 * Tokens for marks that are the only cue to a state or value (an unchecked checkbox ring,
 * a habit's progress arc, the money calendar's spend bar). They keep 3:1 (WCAG 1.4.11) on
 * every surface, where the bright marks may not; test/contrast.test.ts checks them.
 */
export const SOLE_CUE_MARKS = [
  "skyText",
  "mintText",
  "coralText",
  "grapeText",
  "lineStrong",
] as const satisfies readonly ColorName[];

/**
 * A switch's track (components/ui/toggle-row.tsx): on reads like a selected chip, in
 * ink. Its state is a sole cue, so both keep 3:1 on every surface; mint (2.21:1 on a
 * light card) is too faint and means money in.
 */
export const SWITCH_TRACK = {
  on: "ink",
  off: "lineStrong",
} as const satisfies Record<"on" | "off", ColorName>;

/** Text and icons on mango and every other semantic fill: always dark, in both themes. */
export const ON_ACCENT = "#23202B";

/** Accent themes picked in Settings: they only tint the surfaces. */
export const rewardThemes = {
  "mint-breeze": {
    light: { background: "#ECFAF5", line: "#D6EEE5" },
    dark: { background: "#101C1A", card: "#1A2825" },
  },
  "grape-dusk": {
    light: { background: "#F6F1FF", line: "#E6DEF6" },
    dark: { background: "#181424", card: "#241E34" },
  },
} as const satisfies Record<
  string,
  Record<"light" | "dark", Partial<Record<"background" | "card" | "line", string>>>
>;

export type RewardThemeId = keyof typeof rewardThemes;

/** The palette for a scheme with the chosen accent theme's surfaces merged in. */
export function themedPalette(scheme: "light" | "dark", theme?: string | null): Palette {
  const overrides = theme && theme in rewardThemes ? rewardThemes[theme as RewardThemeId] : null;
  return overrides ? { ...palette[scheme], ...overrides[scheme] } : palette[scheme];
}
