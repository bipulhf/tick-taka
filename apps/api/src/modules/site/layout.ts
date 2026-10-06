/** The name on the Google sign-in consent screen; the pages must use exactly this. */
export const APP_NAME = "TickNTaka";

/** Who runs the service, for the public pages; both come from env. */
export interface SiteInfo {
  operator: string;
  contactEmail: string | null;
}

export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );

/**
 * How to reach the operator, as a mailto link when there is an address. The
 * email_off comments stop Cloudflare hiding it behind "[email protected]", which
 * reviewers and readers without JavaScript would see instead.
 */
export const contact = (site: SiteInfo) =>
  site.contactEmail
    ? `<!--email_off--><a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a><!--/email_off-->`
    : escapeHtml(site.operator);

/** One plain page in the app's colours: no scripts, no trackers, no external files. */
export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #FFF8EE; --card: #FFFFFF; --ink: #23202B; --muted: #7D7670; --line: #EEE5D8; --accent: #FFB547; --link: #3F6FE0; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16151C; --card: #22202B; --ink: #F4F1EA; --muted: #A09AA6; --line: #34313F; --link: #7AA2FF; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  header a { color: inherit; text-decoration: none; font-weight: 800; font-size: 20px; }
  .coin { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); display: grid; place-items: center; font-size: 22px; }
  h1 { font-size: 34px; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 21px; margin: 32px 0 8px; }
  p, li { color: var(--ink); }
  .muted { color: var(--muted); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px 22px; margin: 20px 0; }
  ul { padding-left: 22px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 15px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  code { font-size: 14px; background: var(--line); padding: 1px 6px; border-radius: 6px; }
  a { color: var(--link); }
  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 15px; display: flex; gap: 18px; flex-wrap: wrap; }
</style>
</head>
<body>
<main>
<header><span class="coin" aria-hidden="true">⏱</span><a href="/">${APP_NAME}</a></header>
${body}
<footer><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a></footer>
</main>
</body>
</html>`;
}
