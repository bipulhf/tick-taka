// Applies the saved theme before the first paint, so a pinned theme never flashes.
// A file rather than an inline script, so the Content-Security-Policy can forbid inline scripts.
(() => {
  try {
    const theme = localStorage.getItem("tt.theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    const accent = localStorage.getItem("tt.accent");
    if (accent) document.documentElement.dataset.accent = accent;
  } catch (_) {}
})();
