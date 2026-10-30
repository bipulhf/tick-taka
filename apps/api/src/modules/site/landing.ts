import { APP_NAME, contact, escapeHtml, page, type SiteInfo, siteBar, tiki } from "./layout";

/** The Today screen, drawn in HTML: what the app looks like, with no picture to load. */
const todayMock = `<div class="stage rise d3" role="img" aria-label="The Today screen: safe to spend today ৳1,785, the top three tasks, and Tiki logging a rickshaw ride from a chat message.">
<div class="screen" aria-hidden="true">
  <div class="screen-head">${tiki("bob")}<div><b>Good morning</b><small>Spending's comfortably under budget.</small></div></div>
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
</div>
<div class="bubble you" aria-hidden="true">rickshaw 120</div>
<div class="bubble tiki" aria-hidden="true">${tiki()}<span>Logged ৳120 for Transport, from Cash. <u>Undo</u></span></div>
</div>`;

const weekMock = `<div class="demo" role="img" aria-label="A week planner with tasks placed on each day.">
<div class="week" aria-hidden="true">
  <div>Sat<span></span></div><div>Sun<span class="long"></span><span></span></div><div>Mon<span></span><span></span></div>
  <div class="today">Tue<span class="long"></span><span></span><span></span></div><div>Wed<span></span></div>
  <div>Thu<span class="long"></span></div><div>Fri</div>
</div></div>`;

const budgetMock = `<div class="demo budget" role="img" aria-label="Budgets: groceries ৳4,170 of ৳10,000, transport ৳920 of ৳2,500, food ৳6,520 of ৳4,000, over by ৳2,520.">
  <div aria-hidden="true"><p>Groceries <em class="tabular">৳4,170 of ৳10,000</em></p><div class="meter"><i style="width: 42%"></i></div></div>
  <div aria-hidden="true"><p>Transport <em class="tabular">৳920 of ৳2,500</em></p><div class="meter"><i style="width: 37%"></i></div></div>
  <div aria-hidden="true"><p>Food <em class="tabular">৳6,520 of ৳4,000</em></p><div class="meter over"><i style="width: 100%"></i></div><div class="over-note">Over by ৳2,520</div></div>
</div>`;

const ringsMock = `<div class="demo" role="img" aria-label="Habit rings: water 5 of 8, reading on a 7 day streak, a walk on a 3 day streak.">
<div class="rings" aria-hidden="true">
  <div><div class="ring" style="--p: 62%"><b>💧</b></div>Water<small>5/8</small></div>
  <div><div class="ring" style="--p: 100%"><b>📖</b></div>Read<small>7 days</small></div>
  <div><div class="ring" style="--p: 40%"><b>🏃</b></div>Walk<small>3 days</small></div>
</div></div>`;

const chatMock = `<div class="demo chat" role="img" aria-label="A chat with Tiki: you ask what you spent on food this week, Tiki answers ৳1,930 across 11 expenses.">
  <p class="me" aria-hidden="true">এই সপ্তাহে খাবারে কত খরচ হলো?</p>
  <p class="it" aria-hidden="true">৳1,930 on food this week, across 11 expenses. Eating out is most of it.</p>
  <p class="me" aria-hidden="true">call bank tomorrow 5pm</p>
  <p class="it" aria-hidden="true">Added "Call bank" for tomorrow at 5:00 pm. <u>Undo</u></p>
</div>`;

export const landingPage = (site: SiteInfo) =>
  page(
    site,
    {
      title: `${APP_NAME}: a personal planner and money tracker`,
      description: `${APP_NAME} is a personal planner and money tracker for Android and the web: see what to do next and what's safe to spend today, in Bangla or English.`,
    },
    `<header class="hero"><div class="wrap">
${siteBar("/")}
<div class="hero-grid">
  <div>
    <span class="eyebrow rise">Planner and money tracker</span>
    <h1 class="rise d1">Your days and your money, on one screen.</h1>
    <p class="lead rise d2"><strong>${APP_NAME} is a personal planner and money tracker for Android and the web.</strong> It helps one person plan their day and keep track of their own money in one app, in Bangla or English. This page explains what the app does; you don't need an account to read it.</p>
    <div class="cta rise d3"><a class="button primary" href="/app/">Open ${APP_NAME}</a><a class="button quiet" href="#what-it-is-for">See what it does</a></div>
    <p class="fineprint rise d4">Free to use. Sign in with Google. Your records are never sold.</p>
  </div>
  ${todayMock}
</div>
</div></header>

<main id="main">
<section class="wrap" aria-labelledby="what-it-is-for">
  <div class="section-head">
    <h2 id="what-it-is-for">What ${APP_NAME} is for</h2>
    <p>Most people keep their to-do list in one app and their spending in another. ${APP_NAME} puts both in one place, so you can see each day what you have to do and how much you can safely spend.</p>
  </div>
  <div class="rows">
    <div class="row time"><div>
      <div class="tag"><span class="dot"></span>Plan your day</div>
      <h3>Know what's next, not everything at once.</h3>
      <p>Tasks with dates and reminders, a "top three" for each day, projects, habits with streaks, morning and evening routines, and a focus timer that grows a plant.</p>
    </div>${weekMock}</div>
    <div class="row money flip"><div>
      <div class="tag"><span class="dot"></span>Track your money</div>
      <h3>One number for the shop counter.</h3>
      <p>Record expenses and income across cash, bank accounts and mobile wallets such as bKash; set monthly budgets and see a daily "safe to spend" amount; track bills, savings goals and money you lent or borrowed.</p>
    </div>${budgetMock}</div>
    <div class="row review"><div>
      <div class="tag"><span class="dot"></span>Review</div>
      <h3>Small wins, counted. Missed days, shrugged off.</h3>
      <p>Weekly and monthly reviews and simple reports on where your time and money went. Streaks come with freeze days, so one missed day doesn't reset them.</p>
    </div>${ringsMock}</div>
    <div class="row tiki-row flip"><div>
      <div class="tag"><span class="dot"></span>Tiki, the assistant (optional)</div>
      <h3>Type or say it the way you'd say it.</h3>
      <p>Type or speak, for example "spent 120 on rickshaw", and Tiki adds or changes records for you. It always asks before deleting anything, and AI can be switched off.</p>
    </div>${chatMock}</div>
  </div>
  <div class="extras">
    <div><h3>On your home screen</h3><p>The Android widget shows today's safe-to-spend amount and next task, with one-tap buttons for a task, an expense and the things you buy most.</p></div>
    <div><h3>On your laptop</h3><p>The same account <a href="/app/">in the browser</a>, laid out for a bigger screen: plan the week, reconcile money and do the reviews. Press <kbd>N</kbd> to add anything, <kbd>Ctrl</kbd> <kbd>K</kbd> to go anywhere.</p></div>
  </div>
</section>

<section class="wrap trust" aria-labelledby="sign-in">
  <div>
    <h2 id="sign-in">Private by design</h2>
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
</main>`,
  );
