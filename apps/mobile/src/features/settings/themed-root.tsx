import type { ReactNode } from "react";
import { useColorScheme, View } from "react-native";
import { useSettings } from "@/lib/queries";
import { rewardThemeStyle } from "./reward-theme";

/** Applies an unlocked reward theme by overriding the surface colour variables. */
export function ThemedRoot({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <View style={[{ flex: 1 }, rewardThemeStyle(settings?.rewardTheme, scheme)]}>{children}</View>
  );
}
