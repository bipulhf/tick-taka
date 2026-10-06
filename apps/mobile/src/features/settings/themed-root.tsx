import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { type ReactNode, useEffect } from "react";
import { useColorScheme, View } from "react-native";
import { useSettings } from "@/lib/queries";
import { RewardThemeContext } from "@/theme/colors";
import { rewardThemeStyle } from "./reward-theme";

type ThemeChoice = "system" | "light" | "dark";
const THEME_KEY = "tt.theme";

/** Applies the saved Light / Dark / System choice before settings arrive from the cache. */
export async function loadThemeChoice() {
  const saved = (await AsyncStorage.getItem(THEME_KEY)) as ThemeChoice | null;
  if (saved) colorScheme.set(saved);
}

/**
 * Pins the colour scheme from settings and applies the chosen accent theme, both to the
 * CSS variables (class names) and to useColors() (icons, gradients, SVG).
 */
export function ThemedRoot({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const choice = settings?.theme;
  useEffect(() => {
    if (!choice) return;
    colorScheme.set(choice);
    void AsyncStorage.setItem(THEME_KEY, choice);
  }, [choice]);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <RewardThemeContext.Provider value={settings?.rewardTheme ?? null}>
      <View style={[{ flex: 1 }, rewardThemeStyle(settings?.rewardTheme, scheme)]}>{children}</View>
    </RewardThemeContext.Provider>
  );
}
