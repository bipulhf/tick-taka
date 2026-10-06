import { vars } from "nativewind";
import { type RewardThemeId, rewardThemes } from "@/theme/palette";

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(" ");

/** The CSS variables an accent theme overrides, built from the shared palette. */
function cssVars(overrides: Record<string, string>) {
  return vars(
    Object.fromEntries(Object.entries(overrides).map(([name, hex]) => [`--${name}`, rgb(hex)])),
  );
}

/** Accent themes picked in Settings: they only tint the surfaces. */
export const REWARD_THEMES = Object.fromEntries(
  Object.entries(rewardThemes).map(([id, theme]) => [
    id,
    { light: cssVars(theme.light), dark: cssVars(theme.dark) },
  ]),
) as Record<RewardThemeId, { light: ReturnType<typeof vars>; dark: ReturnType<typeof vars> }>;

export function rewardThemeStyle(theme: string | null | undefined, scheme: "light" | "dark") {
  const entry = theme ? REWARD_THEMES[theme as RewardThemeId] : undefined;
  return entry ? entry[scheme] : undefined;
}
