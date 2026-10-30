import { useEffect } from "react";
import { numeralsStore } from "@/lib/format";
import { useSettings } from "@/lib/queries";

/**
 * Applies Settings › Appearance to the page: the theme (System, Light, Dark), the
 * accent tint and the digits for amounts. Kept in localStorage too, so the next
 * visit paints in the right theme before settings load (public/theme-boot.js).
 */
export function ThemeSync() {
  const { data: settings } = useSettings();
  const theme = settings?.theme;
  const accent = settings?.rewardTheme ?? null;
  const numerals = settings?.numerals ?? "latn";

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    localStorage.setItem("tt.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    if (accent) root.dataset.accent = accent;
    else delete root.dataset.accent;
    if (accent) localStorage.setItem("tt.accent", accent);
    else localStorage.removeItem("tt.accent");
  }, [accent, settings]);

  useEffect(() => numeralsStore.set(numerals), [numerals]);
  return null;
}
