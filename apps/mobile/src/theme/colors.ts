import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { type Palette, themedPalette } from "./palette";

export type { ColorName, Palette } from "./palette";

/** The accent theme picked in Settings; ThemedRoot provides it. */
export const RewardThemeContext = createContext<string | null>(null);

/**
 * Colour values for places that need one (icons, charts, SVG, gradients). Matches
 * global.css, including the accent theme's surfaces, so JS colours never drift from
 * the class-based ones.
 */
export function useColors(): Palette {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return themedPalette(scheme, useContext(RewardThemeContext));
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
