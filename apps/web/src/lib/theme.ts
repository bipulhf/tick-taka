import { createStore, useStore } from "./store";

/**
 * Light or dark for this browser, light by default. The top bar's button switches it;
 * it is a browser preference, so the phone keeps its own theme. public/theme-boot.js
 * applies the same choice before the first paint.
 */
export type Theme = "light" | "dark";

const KEY = "tt.theme";
const THEME_COLOR: Record<Theme, string> = { light: "#FFF8EE", dark: "#16151C" };

function saved(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export const themeStore = createStore<Theme>(saved());

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function setTheme(theme: Theme) {
  themeStore.set(theme);
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
}

export const toggleTheme = () => setTheme(themeStore.get() === "dark" ? "light" : "dark");
export const useTheme = () => useStore(themeStore);

apply(themeStore.get());
// Another tab switched: follow it.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  const next = saved();
  themeStore.set(next);
  apply(next);
});
