/**
 * The public pages' one stylesheet, inlined into each page: DESIGN.md's tokens and
 * Nunito (served from /site/nunito.woff2 on this host), so there are no scripts and no
 * files from anywhere else. Light and dark follow the system.
 */
export const SITE_CSS = `
@font-face { font-family: "Nunito"; src: url("/site/nunito.woff2") format("woff2"); font-weight: 200 1000; font-display: swap; }
:root {
  color-scheme: light dark;
  --bg: #FFF8EE; --card: #FFFFFF; --chrome: #F8EFE2; --ink: #23202B; --muted: #6B655F;
  --line: #EEE5D8; --line-strong: #8F8475;
  --mango: #FFB547; --on-mango: #23202B; --sky: #5B8CFF; --mint: #2EC4A0; --coral: #FF7A6B; --grape: #A57BFF;
  --mango-text: #8A5A00; --sky-text: #2C5BCB; --mint-text: #11725D; --coral-text: #B23A2A; --grape-text: #6E44D6;
  --hero: #FFB547; --hero-ink: #23202B; --hero-soft: rgba(35, 32, 43, 0.72);
  --shadow: 0 24px 60px -24px rgba(58, 42, 26, 0.35);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16151C; --card: #22202B; --chrome: #1C1B23; --ink: #F4F1EA; --muted: #A09AA6;
    --line: #34313F; --line-strong: #7A748C;
    --mango: #FFC266; --sky: #7AA2FF; --mint: #4FD8B5; --coral: #FF9385; --grape: #B996FF;
    --mango-text: #FFC266; --sky-text: #7AA2FF; --mint-text: #4FD8B5; --coral-text: #FF9385; --grape-text: #B996FF;
    --hero: #FFC266; --shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 "Nunito", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
a { color: var(--sky-text); text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--sky-text); outline-offset: 3px; border-radius: 6px; }
.skip { position: absolute; left: -9999px; top: 12px; background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 12px; z-index: 10; }
.skip:focus { left: 12px; }
.wrap { width: min(1120px, 100% - 40px); margin-inline: auto; }
.tabular { font-variant-numeric: tabular-nums; }

/* Top bar ---------------------------------------------------------------------- */
.bar { display: flex; align-items: center; gap: 20px; padding: 18px 0; }
.brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; font-weight: 900; font-size: 21px; letter-spacing: -0.01em; }
.brand svg { width: 38px; height: 38px; }
.bar nav { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.bar nav a { color: inherit; text-decoration: none; font-weight: 700; font-size: 15px; padding: 8px 12px; border-radius: 12px; }
.bar nav a:hover { background: rgba(35, 32, 43, 0.08); }
.bar nav a[aria-current="page"] { background: rgba(35, 32, 43, 0.1); }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border-radius: 16px; font: inherit; font-weight: 800; text-decoration: none; transition: transform 150ms var(--ease), background-color 150ms; }
.button:hover { transform: translateY(-1px); text-decoration: none; }
.button.primary { background: var(--ink); color: var(--bg); }
.button.quiet { background: transparent; color: inherit; box-shadow: inset 0 0 0 1.5px currentColor; }
.bar .button { min-height: 40px; padding: 0 16px; font-size: 15px; white-space: nowrap; }
@media (max-width: 560px) { .bar nav a:not(.button) { display: none; } }

/* Landing hero: mango, the app's one accent, carries the brand here. ------------ */
.hero { background: var(--hero); color: var(--hero-ink); border-radius: 0 0 40px 40px; overflow: hidden; }
.hero .bar nav a:hover { background: rgba(35, 32, 43, 0.1); }
.hero-grid { display: grid; gap: 48px; align-items: center; padding: 40px 0 72px; }
@media (min-width: 920px) { .hero-grid { grid-template-columns: 1.05fr 0.95fr; padding: 56px 0 96px; } }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; padding: 6px 12px; border-radius: 999px; background: rgba(35, 32, 43, 0.1); }
.hero h1 { font-size: clamp(42px, 6.4vw, 76px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 900; margin: 20px 0 20px; max-width: 12ch; }
.lead { font-size: clamp(18px, 1.6vw, 21px); line-height: 1.55; color: var(--hero-soft); max-width: 34em; margin: 0; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.hero .button.primary { background: var(--hero-ink); color: var(--hero); }
.fineprint { margin: 18px 0 0; font-size: 15px; font-weight: 600; color: var(--hero-soft); }

/* The mock Today screen: real interface instead of a stock picture. ----------- */
.stage { position: relative; justify-self: center; width: min(420px, 100%); margin-bottom: 40px; }
.screen { background: var(--bg); color: var(--ink); border-radius: 32px; padding: 22px; box-shadow: var(--shadow); transform: rotate(-1.5deg); }
.screen-head { display: flex; align-items: center; gap: 12px; }
.screen-head svg { width: 46px; height: 46px; flex: none; }
.screen-head b { display: block; font-size: 22px; line-height: 1.2; font-weight: 900; }
.screen-head small { color: var(--muted); font-size: 14px; }
.panel { background: var(--card); border-radius: 22px; padding: 16px 18px; margin-top: 14px; }
.label { color: var(--muted); font-size: 14px; }
.big { font-size: 44px; line-height: 1.1; font-weight: 900; color: var(--mint-text); letter-spacing: -0.02em; }
.meter { height: 8px; border-radius: 99px; background: var(--line); margin: 10px 0 8px; overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: 99px; background: var(--mint); }
.split { display: flex; justify-content: space-between; color: var(--muted); font-size: 14px; }
.task { display: flex; align-items: center; gap: 12px; padding: 9px 0; font-weight: 700; font-size: 16px; }
.task + .task { border-top: 1px solid var(--line); }
.task small { display: block; color: var(--muted); font-weight: 600; font-size: 13px; }
.check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--sky-text); flex: none; display: grid; place-items: center; }
.check.done { background: var(--sky); border-color: var(--sky); }
.check.done::after { content: ""; width: 9px; height: 5px; border: solid var(--on-mango); border-width: 0 0 2.5px 2.5px; transform: translateY(-1px) rotate(-45deg); }
.task.done { color: var(--muted); text-decoration: line-through; }
.bubble { position: absolute; max-width: 250px; padding: 12px 16px; border-radius: 20px; font-size: 15px; line-height: 1.4; font-weight: 700; box-shadow: var(--shadow); }
.bubble.you { right: -12px; top: -22px; background: var(--ink); color: var(--bg); border-bottom-right-radius: 6px; }
.bubble.tiki { left: -26px; bottom: -58px; background: var(--card); color: var(--ink); border-bottom-left-radius: 6px; display: flex; gap: 10px; align-items: flex-start; }
.bubble.tiki svg { width: 30px; height: 30px; flex: none; }
.bubble.tiki u { color: var(--sky-text); text-decoration: none; font-weight: 800; }
@media (max-width: 520px) { .bubble.you { right: 0; } .bubble.tiki { left: 0; } }

/* Sections -------------------------------------------------------------------- */
section { padding: 88px 0 0; }
.section-head { max-width: 40em; }
h2 { font-size: clamp(30px, 3.6vw, 44px); line-height: 1.1; letter-spacing: -0.025em; font-weight: 900; margin: 0 0 14px; }
h3 { font-size: 24px; line-height: 1.2; letter-spacing: -0.01em; font-weight: 900; margin: 0 0 10px; }
.section-head p, .row p { color: var(--muted); font-size: 18px; margin: 0; }
.rows { display: grid; gap: 28px; margin-top: 44px; }
.row { display: grid; gap: 28px; align-items: center; background: var(--card); border-radius: 32px; padding: clamp(24px, 4vw, 44px); }
@media (min-width: 860px) { .row { grid-template-columns: 1fr 1fr; gap: 56px; } .row.flip .demo { order: -1; } }
.tag { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 15px; margin-bottom: 12px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.time .tag { color: var(--sky-text); } .time .dot { background: var(--sky); }
.money .tag { color: var(--mint-text); } .money .dot { background: var(--mint); }
.review .tag { color: var(--grape-text); } .review .dot { background: var(--grape); }
.tiki-row .tag { color: var(--mango-text); } .tiki-row .dot { background: var(--mango); }
.demo { background: var(--bg); border-radius: 24px; padding: 18px 20px; }
.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.week div { background: var(--card); border-radius: 12px; padding: 8px 6px 10px; min-height: 104px; font-size: 12px; font-weight: 800; color: var(--muted); }
.week div.today { color: var(--sky-text); box-shadow: inset 0 0 0 2px var(--sky); }
.week span { display: block; margin-top: 6px; height: 18px; border-radius: 6px; background: rgba(91, 140, 255, 0.22); }
.week span.long { height: 34px; }
.budget { display: grid; gap: 12px; }
.budget p { display: flex; justify-content: space-between; margin: 0 0 6px; font-weight: 700; font-size: 15px; color: var(--ink); }
.budget p em { font-style: normal; color: var(--muted); font-weight: 600; }
.budget .meter { margin: 0; }
.budget .meter.over i { background: var(--coral); }
.over-note { color: var(--coral-text); font-size: 13px; font-weight: 700; margin-top: 4px; }
.rings { display: flex; justify-content: space-around; gap: 10px; text-align: center; font-size: 13px; font-weight: 800; }
.ring { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 24px; margin: 0 auto 6px; background: conic-gradient(var(--grape-text) var(--p), var(--line) 0); position: relative; }
.ring::before { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--card); }
.ring b { position: relative; }
.rings small { display: block; color: var(--grape-text); }
.chat { display: grid; gap: 10px; }
.chat p { margin: 0; padding: 10px 14px; border-radius: 18px; font-size: 15px; font-weight: 700; max-width: 85%; color: var(--ink); }
.chat .me { justify-self: end; background: var(--ink); color: var(--bg); border-bottom-right-radius: 6px; }
.chat .it { background: var(--card); border-bottom-left-radius: 6px; }
.chat .it u { text-decoration: none; color: var(--sky-text); font-weight: 800; }
.extras { display: grid; gap: 20px; margin-top: 28px; }
@media (min-width: 760px) { .extras { grid-template-columns: 1fr 1fr; } }
.extras > div { border: 1.5px solid var(--line); border-radius: 28px; padding: 26px 28px; }
.extras p { color: var(--muted); margin: 0; }
kbd { font: inherit; font-size: 13px; font-weight: 800; padding: 1px 7px; border-radius: 7px; border: 1px solid var(--line-strong); color: var(--ink); }

/* Trust: plain promises, then the exact words the consent review reads. ------- */
.trust { display: grid; gap: 40px; }
@media (min-width: 900px) { .trust { grid-template-columns: 0.9fr 1.1fr; gap: 64px; } }
.promises { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.promises li { display: flex; gap: 14px; align-items: flex-start; font-weight: 700; font-size: 18px; }
.promises li::before { content: ""; flex: none; width: 26px; height: 26px; margin-top: 1px; border-radius: 50%; background: var(--mint) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2323202B' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 12.5l4 4 8-9'/%3E%3C/svg%3E") center / 16px no-repeat; }
.prose p { color: var(--ink); margin: 0 0 16px; }
.prose h3 { margin-top: 28px; }
.prose .muted { color: var(--muted); }

/* Footer ---------------------------------------------------------------------- */
footer.site { margin-top: 104px; background: var(--chrome); border-top: 1px solid var(--line); }
footer.site .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; padding: 32px 0 40px; color: var(--muted); font-size: 15px; }
footer.site nav { display: flex; flex-wrap: wrap; gap: 6px 20px; margin-left: auto; }
footer.site a { color: inherit; font-weight: 700; text-decoration: none; }
footer.site a:hover { color: var(--ink); text-decoration: underline; }

/* Legal pages ----------------------------------------------------------------- */
.doc-hero { background: var(--chrome); border-bottom: 1px solid var(--line); }
.doc-hero .bar nav a:hover { background: var(--line); }
.doc-title { padding: 40px 0 48px; }
.doc-title h1 { font-size: clamp(38px, 5vw, 60px); line-height: 1.05; letter-spacing: -0.03em; font-weight: 900; margin: 0 0 10px; }
.doc-title p { margin: 0; color: var(--muted); font-weight: 700; }
.doc { display: grid; gap: 40px; padding-top: 48px; }
@media (min-width: 1000px) { .doc { grid-template-columns: 240px minmax(0, 1fr); gap: 64px; } }
.toc { align-self: start; }
@media (min-width: 1000px) { .toc { position: sticky; top: 24px; } }
.toc p { margin: 0 0 10px; font-weight: 800; font-size: 14px; color: var(--muted); }
.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; border-left: 2px solid var(--line); }
.toc a { display: block; padding: 5px 0 5px 14px; margin-left: -2px; border-left: 2px solid transparent; color: var(--muted); font-weight: 700; font-size: 15px; text-decoration: none; }
.toc a:hover { color: var(--ink); border-left-color: var(--line-strong); }
article { max-width: 70ch; }
article > p:first-child { font-size: 19px; }
article h2 { font-size: 26px; margin: 48px 0 12px; scroll-margin-top: 24px; }
article h2:first-of-type { margin-top: 36px; }
article li { margin: 6px 0; }
article ul { padding-left: 22px; }
.table { overflow-x: auto; margin: 16px 0; border: 1px solid var(--line); border-radius: 20px; background: var(--card); }
table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 15px; line-height: 1.5; }
th, td { text-align: left; vertical-align: top; padding: 14px 16px; }
td + td, th + th { border-left: 1px solid var(--line); }
tbody tr { border-top: 1px solid var(--line); }
th { color: var(--muted); font-weight: 800; font-size: 14px; background: var(--chrome); }
td:first-child { font-weight: 700; }
code { font-size: 14px; background: var(--line); padding: 1px 6px; border-radius: 6px; }
.callout { background: var(--card); border-radius: 20px; padding: 18px 22px; margin: 16px 0; }

/* Motion: one calm entrance, nothing that loops except Tiki's bob. ------------- */
@media (prefers-reduced-motion: no-preference) {
  .rise { animation: rise 700ms var(--ease) both; }
  .rise.d1 { animation-delay: 80ms; } .rise.d2 { animation-delay: 160ms; } .rise.d3 { animation-delay: 240ms; } .rise.d4 { animation-delay: 360ms; }
  .bob { animation: bob 3.2s ease-in-out infinite; }
  @keyframes rise { from { opacity: 0; transform: translateY(18px); } }
  @keyframes bob { 50% { transform: translateY(-4px); } }
}
`;
