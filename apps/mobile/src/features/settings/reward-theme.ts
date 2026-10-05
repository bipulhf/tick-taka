import { vars } from "nativewind";

/** Accent themes picked in Settings: they only tint the surfaces. */
export const REWARD_THEMES = {
  "mint-breeze": {
    light: vars({ "--background": "236 250 245", "--line": "214 238 229" }),
    dark: vars({ "--background": "16 28 26", "--card": "26 40 37" }),
  },
  "grape-dusk": {
    light: vars({ "--background": "246 241 255", "--line": "230 222 246" }),
    dark: vars({ "--background": "24 20 36", "--card": "36 30 52" }),
  },
} as const;

export function rewardThemeStyle(theme: string | null | undefined, scheme: "light" | "dark") {
  const entry = theme ? REWARD_THEMES[theme as keyof typeof REWARD_THEMES] : undefined;
  return entry ? entry[scheme] : undefined;
}
