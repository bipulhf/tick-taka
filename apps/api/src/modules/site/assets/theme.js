// The public pages' light/dark switch. Light unless this browser picked dark; the choice
// is stored as "tt.theme", the same key the web app at /app/ uses, so both agree.
// Loaded in <head> without defer, so the theme is set before the first paint.
(() => {
  const root = document.documentElement;
  const apply = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  };
  let theme = "light";
  try {
    if (localStorage.getItem("tt.theme") === "dark") theme = "dark";
  } catch (_) {}
  apply(theme);
  root.classList.add("js");
  document.addEventListener("DOMContentLoaded", () => {
    for (const button of document.querySelectorAll("[data-theme-toggle]"))
      button.setAttribute("aria-pressed", String(theme === "dark"));
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    theme = root.dataset.theme === "dark" ? "light" : "dark";
    apply(theme);
    button.setAttribute("aria-pressed", String(theme === "dark"));
    try {
      localStorage.setItem("tt.theme", theme);
    } catch (_) {}
  });
})();
