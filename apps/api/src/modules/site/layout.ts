import { SITE_CSS } from "./site-css";

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

/** Tiki, the app's coin with a clock face (apps/mobile/assets/source/tiki-face.svg). */
export function tiki(className = ""): string {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const x = (r: number) => (60 + Math.sin(a) * r).toFixed(1);
    const y = (r: number) => (62 - Math.cos(a) * r).toFixed(1);
    return `<line x1="${x(44)}" y1="${y(44)}" x2="${x(47)}" y2="${y(47)}"/>`;
  }).join("");
  return `<svg class="${className}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="62" r="50" fill="#FFB547" stroke="#E8962A" stroke-width="4"/><circle cx="60" cy="62" r="40" fill="#FFD48F"/><g stroke="#E8962A" stroke-width="2.5" stroke-linecap="round">${ticks}</g><g stroke="#E8962A" stroke-width="3.5" stroke-linecap="round"><line x1="60" y1="36" x2="60" y2="25"/><line x1="60" y1="36" x2="68" y2="31"/></g><circle cx="60" cy="36" r="3" fill="#E8962A"/><g opacity="0.55"><circle cx="38" cy="68" r="5" fill="#FF9385"/><circle cx="82" cy="68" r="5" fill="#FF9385"/></g><circle cx="48" cy="57" r="5" fill="#3A2A1A"/><circle cx="72" cy="57" r="5" fill="#3A2A1A"/><circle cx="49.5" cy="55.5" r="1.6" fill="#FFF8EE"/><circle cx="73.5" cy="55.5" r="1.6" fill="#FFF8EE"/><path d="M49 70 Q60 80 71 70" stroke="#3A2A1A" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`;
}

export type SitePath = "/" | "/privacy" | "/terms";

const icon = (cls: string, body: string) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Light or dark, worked by /site/theme.js; hidden until that script runs. */
const THEME_BUTTON = `<button type="button" class="theme-toggle" data-theme-toggle aria-label="Dark theme" aria-pressed="false">${icon("moon", '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>')}${icon("sun", '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>')}</button>`;

/** The wordmark, the three pages and the way into the web app. */
export function siteBar(current: SitePath): string {
  const link = (href: SitePath, label: string) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<div class="bar">
<a class="brand" href="/">${tiki()}${APP_NAME}</a>
<nav aria-label="Site">${link("/privacy", "Privacy")}${link("/terms", "Terms")}${THEME_BUTTON}<a class="button primary" href="/app/">Open the app</a></nav>
</div>`;
}

function siteFooter(site: SiteInfo): string {
  return `<footer class="site"><div class="wrap">
<span>${APP_NAME} is run by ${escapeHtml(site.operator)}.${site.contactEmail ? ` Contact: ${contact(site)}.` : ""}</span>
<nav aria-label="Footer"><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/app/">Open the app</a></nav>
</div></footer>`;
}

/** The whole document: no trackers and no files from other hosts; one tiny script, the theme switch. */
export function page(
  site: SiteInfo,
  meta: { title: string; description: string; css?: string; bodyClass?: string },
  content: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<meta name="theme-color" content="#FFF8EE">
<link rel="preload" href="/site/nunito.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script src="/site/theme.js"></script>
<style>${SITE_CSS}${meta.css ?? ""}</style>
</head>
<body${meta.bodyClass ? ` class="${meta.bodyClass}"` : ""}>
<a class="skip" href="#main">Skip to content</a>
${content}
${siteFooter(site)}
</body>
</html>`;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A privacy policy or terms page: a title band, then the text with a contents list
 * built from its headings (each heading gets an id so the list can link to it).
 */
export function docPage(
  site: SiteInfo,
  meta: { title: string; description: string; path: SitePath; heading: string; updated: string },
  body: string,
): string {
  const headings: { id: string; text: string }[] = [];
  const withIds = body.replace(/<h2>(.*?)<\/h2>/g, (_, text: string) => {
    const id = slug(text);
    headings.push({ id, text });
    return `<h2 id="${id}">${text}</h2>`;
  });
  const toc = headings
    .map((h) => `<li><a href="#${h.id}">${h.text.replace(/^\d+\.\s*/, "")}</a></li>`)
    .join("");
  return page(
    site,
    meta,
    `<header class="doc-hero"><div class="wrap">
${siteBar(meta.path)}
<div class="doc-title"><h1>${meta.heading}</h1><p>Last updated ${meta.updated}</p></div>
</div></header>
<main id="main" class="wrap doc">
<nav class="toc" aria-label="On this page"><p>On this page</p><ol>${toc}</ol></nav>
<article>${withIds}</article>
</main>`,
  );
}
