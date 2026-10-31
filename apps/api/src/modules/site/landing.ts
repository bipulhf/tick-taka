import { LANDING_CSS } from "./landing-css";
import { APP_NAME, contact, escapeHtml, page, type SiteInfo, siteBar, tiki } from "./layout";

/** The Today screen, drawn in HTML: what the app looks like, with no picture to load. */
const todayMock = `<div class="screen" aria-hidden="true">
  <div class="screen-head">${tiki()}<div><b>Good morning</b><small>Spending's comfortably under budget.</small></div></div>
  <div class="panel">
    <div class="label">Safe to spend today</div>
    <div class="big tabular">৳1,785</div>
    <div class="meter"><i style="width: 20%"></i></div>
    <div class="split tabular"><span>৳440 spent of ৳2,225</span><span>2 days left</span></div>
  </div>
  <div class="panel">
    <div class="label">Top three</div>
    <div class="task done"><span class="check done"></span><span>Send invoice to Bonolota<small>15m</small></span></div>
    <div class="task"><span class="check"></span><span>Finish thesis chapter 3 draft<small>10:00 am · 2h</small></span></div>
    <div class="task"><span class="check"></span><span>Mark quiz papers, class 9<small>1h</small></span></div>
  </div>
</div>`;

const scene = `<div class="scene" role="img" aria-label="The Today screen, with Tiki the coin cheering: safe to spend today ৳1,785 and the top three tasks.">
  <span class="tape" aria-hidden="true"></span>
  ${todayMock}
  <div class="say two" aria-hidden="true">৳850 on biryani? Bold. Logged.</div>
  ${tiki("big-tiki")}
  <div class="say one" aria-hidden="true">One of three done. Look at you go.</div>
</div>`;

/** Things people actually type into quick-add; it works out the rest. */
const TYPED = [
  "cha 20",
  "+45000 salary",
  "2h thesis",
  "call bank tomorrow 5pm",
  "rickshaw 120",
  "biryani with friends 850",
  "gym every mon wed fri",
  "বাজার ৫০০",
  "bkash to cash 2000",
  "pay rent on the 5th",
];
const marquee = `<div class="marquee" aria-hidden="true"><div class="track">${[...TYPED, ...TYPED]
  .map((line) => `<span>${escapeHtml(line)}</span>`)
  .join("")}</div></div>`;

const weekMock = `<div class="demo" role="img" aria-label="A week planner with tasks placed on each day.">
<div class="week" aria-hidden="true">
  <div>Sat<span></span></div><div>Sun<span class="long"></span><span></span></div><div>Mon<span></span><span></span></div>
  <div class="today">Tue<span class="long"></span><span></span><span></span></div><div>Wed<span></span></div>
  <div>Thu<span class="long"></span></div><div>Fri</div>
</div></div>`;

const budgetMock = `<div class="demo budget" role="img" aria-label="Budgets: groceries ৳4,170 of ৳10,000, food ৳6,520 of ৳4,000, over by ৳2,520.">
  <div aria-hidden="true"><p>Groceries <em class="tabular">৳4,170 of ৳10,000</em></p><div class="meter"><i style="width: 42%"></i></div></div>
  <div aria-hidden="true"><p>Food <em class="tabular">৳6,520 of ৳4,000</em></p><div class="meter over"><i style="width: 100%"></i></div><div class="over-note">Over by ৳2,520</div></div>
</div>`;

const ringsMock = `<div class="demo" role="img" aria-label="Habit rings: water 5 of 8, reading on a 7 day streak, a walk on a 3 day streak.">
<div class="rings" aria-hidden="true">
  <div><div class="ring" style="--p: 62%"><b>💧</b></div>Water<small>5/8</small></div>
  <div><div class="ring" style="--p: 100%"><b>📖</b></div>Read<small>7 days</small></div>
  <div><div class="ring" style="--p: 40%"><b>🏃</b></div>Walk<small>3 days</small></div>
</div></div>`;

const chatMock = `<div class="demo chat" role="img" aria-label="A chat with Tiki: you ask what you spent on food this week and Tiki answers ৳1,930; you type call bank tomorrow 5pm and Tiki adds it.">
  <p class="me" aria-hidden="true">এই সপ্তাহে খাবারে কত খরচ হলো?</p>
  <p class="it" aria-hidden="true">৳1,930 on food this week, across 11 expenses.</p>
  <p class="me" aria-hidden="true">call bank tomorrow 5pm</p>
  <p class="it" aria-hidden="true">Added "Call bank" for tomorrow at 5:00 pm. <u>Undo</u></p>
</div>`;

const QUIPS = [
  ["Missed yesterday? I didn't see a thing.", "Streaks get two freeze days a month."],
  ["Under budget again. Who even are you?", "Safe to spend, updated as you log."],
  ["Deleting that? Tap once more. No judgement.", "Deleted something by mistake? Undo."],
  ["All three done before lunch. Show-off.", "Confetti, obviously."],
];

export const landingPage = (site: SiteInfo) =>
  page(
    site,
    {
      title: `${APP_NAME}: a personal planner and money tracker`,
      description: `${APP_NAME} is a personal planner and money tracker for Android and the web: see what to do next and what's safe to spend today, in Bangla or English.`,
      css: LANDING_CSS,
      bodyClass: "landing",
    },
    `<header class="wrap">
${siteBar("/")}
<div class="pop">
  <div>
    <div class="stickers rise"><span class="sticker">বাংলা + English</span><span class="sticker">No ads. Ever.</span><span class="sticker">Phone + browser</span></div>
    <h1 class="rise d1">Your days. <span class="mango">Your taka.</span> <span class="hl">One app.</span></h1>
    <p class="lead rise d2"><strong>${APP_NAME} is a personal planner and money tracker for Android and the web.</strong> It helps one person plan their day and keep track of their own money in one app, in Bangla or English. This page explains what the app does; you don't need an account to read it.</p>
    <div class="cta rise d3"><a class="button primary" href="/app/">Open ${APP_NAME}</a><a class="button quiet" href="#what-it-is-for">What does it do?</a></div>
    <p class="fineprint rise d4">Free. Sign in with Google. Your records are never sold.</p>
  </div>
  ${scene}
</div>
</header>
${marquee}

<main id="main">
<section class="wrap" aria-labelledby="what-it-is-for">
  <div class="section-head">
    <h2 id="what-it-is-for">What ${APP_NAME} is for</h2>
    <p>Most people keep their to-do list in one app and their spending in another. ${APP_NAME} puts both in one place, so you can see each day what you have to do and how much you can safely spend.</p>
  </div>
  <div class="board">
    <article class="card card-a"><div>
      <p class="tag"><span class="dot" style="background: var(--sky)"></span>Plan your day</p>
      <h3>Three things today. Not thirty.</h3>
      <p>Tasks with dates and reminders, a "top three" for each day, projects, habits with streaks, morning and evening routines, and a focus timer that grows a plant.</p>
    </div>${weekMock}</article>
    <article class="card card-b"><span class="corner">৳ checked</span>
      <p class="tag"><span class="dot" style="background: var(--mint)"></span>Track your money</p>
      <h3>One number. Zero lectures.</h3>
      <p>Cash, banks and bKash in one place, monthly budgets and a daily "safe to spend", plus bills, savings goals and who owes whom.</p>
      ${budgetMock}
    </article>
    <article class="card card-c">
      <p class="tag"><span class="dot" style="background: var(--grape)"></span>Review</p>
      <h3>Streaks with a forgiveness clause.</h3>
      <p>Weekly and monthly reviews and simple reports on where your time and money went. Freeze days mean one off day doesn't reset anything.</p>
      ${ringsMock}
    </article>
    <article class="card card-d"><span class="corner">optional</span><div>
      <p class="tag"><span class="dot" style="background: var(--mango)"></span>Tiki, the assistant</p>
      <h3>Just say it. Tiki writes it down.</h3>
      <p>Type or speak, for example "spent 120 on rickshaw", and Tiki adds or changes records for you. It always asks before deleting anything, and AI can be switched off.</p>
    </div>${chatMock}</article>
  </div>
  <div class="extras">
    <div><h3>On your home screen</h3><p>The Android widget shows today's safe-to-spend amount and next task, with one-tap buttons for a task, an expense and the things you buy most.</p></div>
    <div><h3>On your laptop</h3><p>The same account <a href="/app/">in the browser</a>, made for a bigger screen. Press <kbd>N</kbd> to add anything, <kbd>Ctrl</kbd> <kbd>K</kbd> to go anywhere.</p></div>
  </div>
</section>

<section class="wrap center" aria-labelledby="tiki-says">
  <div class="section-head">
    <h2 id="tiki-says">Tiki has notes.</h2>
    <p>A coin with a clock face that cheers the small wins and shrugs at the misses. It never scolds.</p>
  </div>
  <div class="quips">${QUIPS.map(([line, note]) => `<p class="quip">${escapeHtml(line as string)}<small>${escapeHtml(note as string)}</small></p>`).join("")}</div>
</section>

<section class="wrap trust" aria-labelledby="sign-in">
  <div>
    <h2 id="sign-in">Your data minds its own business.</h2>
    <ul class="promises">
      <li>Never sold, never used for advertising</li>
      <li>Never shown to other users</li>
      <li>No ads, analytics or trackers</li>
      <li>Export everything, or delete your account, at any time</li>
    </ul>
  </div>
  <div class="prose">
    <h3>Why it asks you to sign in with Google</h3>
    <p>${APP_NAME} uses Google Sign-In only to know who you are, so your planner and money records are kept in your own private space on our server and you can use them on a new phone. It asks Google for your name, email address and profile picture, and nothing else: it cannot read your Gmail, Drive, contacts or any other Google data.</p>
    <h3>Your privacy</h3>
    <p>Your records belong to you. They are never sold, never used for advertising, and never shown to other users. You can export everything or ask us to delete your account at any time. Read the full <a href="/privacy">privacy policy</a> and the <a href="/terms">terms of service</a>.</p>
    <h3>Contact</h3>
    <p>${APP_NAME} is run by ${escapeHtml(site.operator)}. Questions or requests: ${contact(site)}.</p>
  </div>
</section>

<div class="wrap"><div class="finale">
  ${tiki("bob")}
  <div><h2>Go on. Log your first cha.</h2><p>Takes five seconds. Tiki will act like it's a big deal.</p></div>
  <a class="button primary" href="/app/">Open ${APP_NAME}</a>
</div></div>
</main>`,
  );
