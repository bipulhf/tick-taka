import { useColorScheme } from "react-native";

/** Raw palette for places that need a colour value (icons, charts, SVG). Matches global.css. */
type PaletteShape = Record<
  "mango" | "sky" | "mint" | "coral" | "grape" | "background" | "card" | "ink" | "muted" | "line",
  string
>;

export const palette: { light: PaletteShape; dark: PaletteShape } = {
  light: {
    mango: "#FFB547",
    sky: "#5B8CFF",
    mint: "#2EC4A0",
    coral: "#FF7A6B",
    grape: "#A57BFF",
    background: "#FFF8EE",
    card: "#FFFFFF",
    ink: "#23202B",
    muted: "#7D7670",
    line: "#EEE5D8",
  },
  dark: {
    mango: "#FFC266",
    sky: "#7AA2FF",
    mint: "#4FD8B5",
    coral: "#FF9385",
    grape: "#B996FF",
    background: "#16151C",
    card: "#22202B",
    ink: "#F4F1EA",
    muted: "#A09AA6",
    line: "#34313F",
  },
};

export type Palette = PaletteShape;
export type ColorName = keyof Palette;

export function useColors(): Palette {
  return useColorScheme() === "dark" ? palette.dark : palette.light;
}

/**
 * Chart marks for money in / money out, validated for colour-blind separation and the
 * lightness band in each mode (dataviz validator). Text never uses these colours.
 */
export const chartPalette = {
  light: { moneyIn: "#26B592", moneyOut: "#F2685A", time: "#5B8CFF" },
  dark: { moneyIn: "#2AAA89", moneyOut: "#E8604F", time: "#6F96F2" },
} as const;

export function useChartColors() {
  return useColorScheme() === "dark" ? chartPalette.dark : chartPalette.light;
}
