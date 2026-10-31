import { useEffect } from "react";
import { numeralsStore } from "@/lib/format";
import { useSettings } from "@/lib/queries";

/**
 * Applies the synced appearance settings to the page: the accent tint and the digits for
 * amounts. The accent is kept in localStorage too, so the next visit paints with it
 * before settings load (public/theme-boot.js). Light or dark is this browser's own
 * choice (lib/theme.ts), not a synced setting.
 */
export function ThemeSync() {
  const { data: settings } = useSettings();
  const accent = settings?.rewardTheme ?? null;
  const numerals = settings?.numerals ?? "latn";

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
