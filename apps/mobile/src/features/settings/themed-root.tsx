import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { type ReactNode, useEffect } from "react";
import { useColorScheme, View } from "react-native";
import { useSettings } from "@/lib/queries";
import { rewardThemeStyle } from "./reward-theme";

type ThemeChoice = "system" | "light" | "dark";
const THEME_KEY = "tt.theme";

/** Applies the saved Light / Dark / System choice before settings arrive from the cache. */
export async function loadThemeChoice() {
  const saved = (await AsyncStorage.getItem(THEME_KEY)) as ThemeChoice | null;
  if (saved) colorScheme.set(saved);
}

/** Pins the colour scheme from settings and applies any unlocked reward theme. */
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
    <View style={[{ flex: 1 }, rewardThemeStyle(settings?.rewardTheme, scheme)]}>{children}</View>
  );
}
