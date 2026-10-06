import { type ColorName, palette } from "@/theme/palette";

/**
 * Area colours are stored as their light hex (the API validates a hex colour), but shown
 * through the theme's tokens so they adapt to dark mode, and announced by name.
 */
export const AREA_SWATCHES: { hex: string; name: string; token?: ColorName; dark?: string }[] = [
  { hex: "#5B8CFF", name: "Blue", token: "sky" },
  { hex: "#7A6BFF", name: "Indigo", dark: "#9A8FFF" },
  { hex: "#FFB547", name: "Mango", token: "mango" },
  { hex: "#2EC4A0", name: "Green", token: "mint" },
  { hex: "#FF7A6B", name: "Coral", token: "coral" },
  { hex: "#A57BFF", name: "Purple", token: "grape" },
];

export const AREA_COLORS = AREA_SWATCHES.map((swatch) => swatch.hex);

const find = (hex: string) =>
  AREA_SWATCHES.find((swatch) => swatch.hex.toLowerCase() === hex.toLowerCase());

/** "Blue", "Purple"…; never a hex code. */
export function areaColorName(hex: string): string {
  return find(hex)?.name ?? "Custom colour";
}

/** The colour to draw for a stored area colour in the current scheme. */
export function areaColorValue(hex: string, scheme: "light" | "dark"): string {
  const swatch = find(hex);
  if (!swatch) return hex;
  if (swatch.token) return palette[scheme][swatch.token];
  return scheme === "dark" && swatch.dark ? swatch.dark : swatch.hex;
}
