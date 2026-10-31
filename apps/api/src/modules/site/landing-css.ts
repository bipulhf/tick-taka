/**
 * The home page's sticker-book look, on top of SITE_CSS: dotted paper, chunky type,
 * tilted stickers with hard shadows, Tiki's speech bubbles and a quick-add marquee.
 * Pure CSS; every animation stops when the system asks for reduced motion.
 */
export const LANDING_CSS = `
:root { --paper-dot: rgba(35, 32, 43, 0.09); --edge: #23202B; --hard: 5px 6px 0 #23202B; --tint-sky: #E3ECFF; --tint-mint: #DDF6EE; --tint-grape: #EEE6FF; --tint-mango: #FFE9C7; --tint-coral: #FFE4E0; }
@media (prefers-color-scheme: dark) {
  :root { --paper-dot: rgba(244, 241, 234, 0.07); --edge: #F4F1EA; --hard: 5px 6px 0 #000; --tint-sky: #232B45; --tint-mint: #1C3530; --tint-grape: #2C2342; --tint-mango: #3A2E1A; --tint-coral: #3D2524; }
}
html:has(body.landing) { overflow-x: clip; }
body.landing { background-color: var(--bg); background-image: radial-gradient(var(--paper-dot) 1.2px, transparent 1.3px); background-size: 22px 22px; overflow-x: hidden; }
.landing .bar nav a:hover { background: var(--line); }
.landing .button { border: 2.5px solid var(--edge); box-shadow: var(--hard); transition: transform 160ms var(--ease), box-shadow 160ms var(--ease); }
.landing .button:hover { transform: translate(-2px, -2px); box-shadow: 7px 8px 0 var(--edge); }
.landing .button:active { transform: translate(3px, 3px); box-shadow: 1px 2px 0 var(--edge); }
.landing .button.primary { background: var(--mango); color: var(--on-mango); }
.landing .button.quiet { background: var(--card); color: var(--ink); box-shadow: var(--hard); }
.landing .bar .button { box-shadow: 3px 4px 0 var(--edge); border-width: 2px; }

/* Hero ------------------------------------------------------------------------- */
.pop { display: grid; gap: 56px; align-items: center; padding: 36px 0 40px; }
@media (min-width: 960px) { .pop { grid-template-columns: 1.1fr 0.9fr; padding: 56px 0 72px; } }
.stickers { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
.sticker { display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; border: 2px solid var(--edge); border-radius: 999px; font-weight: 900; font-size: 14px; background: var(--card); box-shadow: 3px 3px 0 var(--edge); }
.sticker:nth-child(1) { transform: rotate(-3deg); background: var(--tint-mint); }
.sticker:nth-child(2) { transform: rotate(2deg); background: var(--tint-grape); }
.sticker:nth-child(3) { transform: rotate(-1.5deg); background: var(--tint-sky); }
.pop h1 { font-size: clamp(50px, 7.6vw, 104px); line-height: 0.95; letter-spacing: -0.045em; font-weight: 1000; margin: 0 0 26px; }
.pop h1 .hl { position: relative; display: inline-block; white-space: nowrap; }
.pop h1 .hl::after { content: ""; position: absolute; left: -2%; right: -4%; bottom: -0.12em; height: 0.32em; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 30' preserveAspectRatio='none'%3E%3Cpath d='M4 20 C 60 6, 120 28, 180 14 S 270 8, 296 18' fill='none' stroke='%23FF7A6B' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E") center / 100% 100% no-repeat; z-index: -1; }
.pop h1 .mango { color: var(--mango-text); }
.pop .lead { color: var(--muted); max-width: 33em; font-size: clamp(18px, 1.5vw, 20px); }
.pop .lead strong { color: var(--ink); }
.pop .cta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 30px; }
.pop .fineprint { color: var(--muted); font-weight: 700; font-size: 15px; margin: 22px 0 0; }

/* Tiki and the phone, stuck to the page --------------------------------------- */
.scene { position: relative; justify-self: center; width: min(440px, 100%); padding: 40px 0 128px; }
.scene .screen { transform: rotate(2.5deg); border: 2.5px solid var(--edge); box-shadow: 8px 10px 0 var(--edge); }
.tape { position: absolute; top: 24px; left: 50%; width: 120px; height: 30px; margin-left: -60px; background: rgba(255, 181, 71, 0.55); transform: rotate(-4deg); z-index: 2; border-radius: 3px; }
.big-tiki { position: absolute; left: -38px; bottom: 0; width: 132px; height: 132px; z-index: 3; filter: drop-shadow(4px 5px 0 var(--edge)); }
.say { position: absolute; z-index: 4; max-width: 230px; padding: 11px 15px; border: 2.5px solid var(--edge); border-radius: 20px; background: var(--card); color: var(--ink); font-weight: 900; font-size: 15px; line-height: 1.3; box-shadow: 4px 4px 0 var(--edge); }
.say.one { left: 116px; bottom: 34px; transform: rotate(-4deg); border-bottom-left-radius: 4px; }
.say.two { right: -18px; top: 0; transform: rotate(5deg); background: var(--mango); color: var(--on-mango); border-bottom-right-radius: 4px; }
@media (max-width: 560px) { .big-tiki { left: -6px; width: 104px; height: 104px; } .say.one { left: 96px; bottom: 30px; } .say.two { right: 0; } }

/* Marquee of things people type ----------------------------------------------- */
.marquee { background: #23202B; color: #FFF8EE; border-block: 2.5px solid var(--edge); transform: rotate(-1.2deg); margin: 8px -40px 0; overflow: hidden; }
.marquee .track { display: flex; width: max-content; gap: 0; padding: 16px 0; }
.marquee span { font-weight: 900; font-size: clamp(18px, 2vw, 24px); white-space: nowrap; padding: 0 22px; }
.marquee span:nth-child(odd) { color: #FFC266; }
.marquee span::after { content: "✦"; margin-left: 44px; color: #FFF8EE; opacity: 0.5; }

/* Sticker cards ---------------------------------------------------------------- */
.landing section { padding-top: 104px; }
.landing h2 { font-size: clamp(36px, 4.6vw, 60px); letter-spacing: -0.035em; font-weight: 1000; line-height: 1; }
.landing .section-head p { font-size: 19px; }
.board { display: grid; gap: 30px; margin-top: 52px; }
@media (min-width: 900px) { .board { grid-template-columns: repeat(6, 1fr); } .card-a { grid-column: span 4; } .card-b { grid-column: span 2; } .card-c { grid-column: span 2; } .card-d { grid-column: span 4; } }
.card { align-self: start; position: relative; border: 2.5px solid var(--edge); border-radius: 30px; padding: clamp(24px, 3.4vw, 36px); box-shadow: 8px 9px 0 var(--edge); display: grid; gap: 22px; align-content: start; }
.card h3 { font-size: clamp(26px, 2.6vw, 34px); line-height: 1.05; letter-spacing: -0.02em; font-weight: 1000; margin: 0; }
.card p { margin: 0; color: var(--ink); opacity: 0.82; font-size: 17px; }
.card .tag { margin: 0; color: var(--ink); }
.card .tag .dot { border: 2px solid var(--edge); width: 14px; height: 14px; }
.card .demo { background: var(--card); border: 2px solid var(--edge); }
.card-a { background: var(--tint-sky); transform: rotate(-0.8deg); }
.card-b { background: var(--tint-mint); transform: rotate(1.2deg); }
.card-c { background: var(--tint-grape); transform: rotate(-1.4deg); }
.card-d { background: var(--tint-mango); transform: rotate(0.7deg); }
@media (min-width: 900px) { .card-a, .card-d { grid-template-columns: 1fr 1fr; align-items: center; } }
.card .corner { position: absolute; top: -18px; right: 22px; padding: 5px 12px; border: 2px solid var(--edge); border-radius: 999px; background: var(--card); font-weight: 900; font-size: 13px; transform: rotate(6deg); box-shadow: 3px 3px 0 var(--edge); }

/* Tiki's one-liners ------------------------------------------------------------ */
.quips { display: flex; flex-wrap: wrap; justify-content: center; gap: 22px 26px; margin-top: 44px; }
.quip { max-width: 245px; padding: 16px 20px; border: 2.5px solid var(--edge); border-radius: 24px; background: var(--card); font-weight: 900; font-size: 18px; line-height: 1.3; box-shadow: 5px 5px 0 var(--edge); }
.quip small { display: block; margin-top: 6px; font-size: 13px; color: var(--muted); font-weight: 800; }
.quip:nth-child(1) { transform: rotate(-3deg); border-bottom-left-radius: 6px; }
.quip:nth-child(2) { transform: rotate(2deg); background: var(--tint-coral); border-bottom-right-radius: 6px; }
.quip:nth-child(3) { transform: rotate(-1deg); background: var(--tint-grape); border-bottom-left-radius: 6px; }
.quip:nth-child(4) { transform: rotate(3deg); background: var(--tint-mint); border-bottom-right-radius: 6px; }
.center { text-align: center; }
.center .section-head { margin-inline: auto; }

/* Trust and the last nudge ------------------------------------------------------ */
.landing .trust .promises li::before { border: 2px solid var(--edge); }
.landing .prose { background: var(--card); border: 2.5px solid var(--edge); border-radius: 30px; padding: clamp(24px, 3.4vw, 36px); box-shadow: 8px 9px 0 var(--edge); }
.landing .prose h3:first-child { margin-top: 0; }
.finale { margin-top: 104px; background: var(--mango); color: var(--on-mango); border: 2.5px solid var(--edge); border-radius: 40px; padding: clamp(36px, 6vw, 72px); box-shadow: 10px 12px 0 var(--edge); display: grid; gap: 28px; align-items: center; transform: rotate(-0.6deg); }
@media (min-width: 860px) { .finale { grid-template-columns: auto 1fr auto; } }
.finale svg { width: 120px; height: 120px; }
.finale h2 { margin: 0; color: var(--on-mango); }
.finale p { margin: 8px 0 0; font-weight: 700; font-size: 18px; color: rgba(35, 32, 43, 0.78); }
.finale .button.primary { background: var(--on-mango); color: #FFB547; border-color: var(--on-mango); box-shadow: 5px 6px 0 rgba(35, 32, 43, 0.35); }
.landing footer.site { margin-top: 96px; }

@media (prefers-reduced-motion: no-preference) {
  .marquee .track { animation: slide 38s linear infinite; }
  .marquee:hover .track { animation-play-state: paused; }
  @keyframes slide { to { transform: translateX(-50%); } }
  .say.one { animation: nod 4.5s ease-in-out infinite; }
  .say.two { animation: nod 5s ease-in-out 1.2s infinite; }
  @keyframes nod { 50% { translate: 0 -5px; } }
  .sticker, .quip, .card { transition: transform 220ms var(--ease); }
  .sticker:hover, .quip:hover { transform: rotate(0deg) scale(1.04); }
  .card:hover { transform: rotate(0deg); }
}
`;
