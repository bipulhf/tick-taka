import { useColorScheme } from "react-native";
import { type Palette, palette } from "./palette";

export type { ColorName, Palette } from "./palette";

/** Colour values for places that need one (icons, charts, SVG). Matches global.css. */
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
