// Applies the theme before the first paint: light unless this browser picked dark with the
// top bar's button. A file rather than an inline script, so the Content-Security-Policy can
// forbid inline scripts.
(() => {
  try {
    const dark = localStorage.getItem("tt.theme") === "dark";
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    const accent = localStorage.getItem("tt.accent");
    if (accent) root.dataset.accent = accent;
  } catch (_) {}
})();
