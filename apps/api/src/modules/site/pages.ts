import { contact, escapeHtml, page, type SiteInfo } from "./layout";

const UPDATED = "6 October 2026";

export const landingPage = (site: SiteInfo) =>
  page(
    "Tick & Taka: your day and your money in one place",
    `<h1>Your day and your money, in one calm place.</h1>
<p class="muted">Tick &amp; Taka is an Android app for planning your day and keeping track of your money, in Bangla or English.</p>
<div class="card">
<ul>
  <li><strong>Plan:</strong> tasks, a top three for each day, habits, routines and a focus timer.</li>
  <li><strong>Money:</strong> expenses and income across cash, bank and mobile wallets, budgets with a daily "safe to spend" number, bills, savings goals and debts.</li>
  <li><strong>Review:</strong> weekly and monthly reviews, and reports on where time and money went.</li>
  <li><strong>Tiki:</strong> an optional assistant you can type or talk to, which adds and changes things for you and always asks before deleting anything.</li>
</ul>
</div>
<p>You sign in with your Google account. Your records are kept in a database of your own on our server and are never sold or shown to anyone else.</p>
<p>Read the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms of service</a>. Questions: ${contact(site)}.</p>
<p class="muted">Run by ${escapeHtml(site.operator)}.</p>`,
  );

export const privacyPage = (site: SiteInfo) =>
  page(
    "Privacy policy · Tick & Taka",
    `<h1>Privacy policy</h1>
<p class="muted">Last updated ${UPDATED}</p>
<p>This policy explains what Tick &amp; Taka ("the app", "we") collects, why, and what you can do about it. The app is run by ${escapeHtml(site.operator)}. Contact: ${contact(site)}.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Your Google account basics.</strong> When you sign in with Google we receive your name, email address and profile picture, and Google's account ID. We use them only to sign you in, show who is signed in, and keep your data separate from everyone else's. We do not get your Google password or access to your Gmail, Drive, contacts or any other Google data.</li>
  <li><strong>What you put in the app.</strong> Tasks, projects, areas, habits, routines, time entries, transactions, accounts, categories, budgets, bills, goals, debts, events, shopping lists, settings and receipt photos you attach.</li>
  <li><strong>Assistant chats.</strong> Messages you send to Tiki are kept on your phone. To answer, recent messages are sent to our server and to the AI provider (see below); the server does not keep the chat.</li>
  <li><strong>AI usage records.</strong> For each AI request we store the feature used, the model, the number of tokens and the cost, so you can see what AI cost. Not the content.</li>
</ul>
<p>We do not use advertising, analytics or tracking tools, and we do not collect your location or contacts.</p>

<h2>How AI features use your data</h2>
<p>AI features are optional and can be switched off, all at once or one by one, in Settings › AI. When you use one, the text, receipt photo or voice recording needed for that request is sent to OpenAI to process, together with the names of your accounts, categories and areas and, for the assistant, the records it looks up to answer you. Voice recordings are turned into text and not stored by us. OpenAI processes this data under its API terms and does not use API data to train its models by default.</p>

<h2>Where your data is kept</h2>
<p>Your records are stored on our server in a database file of your own, reachable only when you are signed in. Each night a backup copy is made and the newest 14 are kept. The app also keeps a copy on your phone so it works offline; signing out removes it from the phone.</p>

<h2>Who we share it with</h2>
<p>We never sell your data or share it for advertising. It is shared only with OpenAI when you use an AI feature, as described above, and with Google for sign-in. We may disclose data if the law requires it.</p>

<h2>Google user data</h2>
<p>Tick &amp; Taka's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We use your Google name, email and picture only to sign you in and show your account in the app.</p>

<h2>Your choices</h2>
<ul>
  <li><strong>See and export:</strong> Settings › Your data exports everything as one file.</li>
  <li><strong>Correct or delete records:</strong> edit or delete anything in the app at any time.</li>
  <li><strong>Delete your account:</strong> email ${contact(site)} from the address you sign in with. We delete your account, records, receipt photos and backups within 30 days.</li>
  <li><strong>Revoke access:</strong> you can also remove Tick &amp; Taka from your Google account at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
</ul>

<h2>Security</h2>
<p>Data travels over HTTPS. Each person's records are kept in a separate database file, and the app can be locked with your fingerprint. No system is perfectly secure, but we take reasonable care to protect your data.</p>

<h2>Children</h2>
<p>The app is not meant for children under 13, and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>If this policy changes we will update the date above, and tell you in the app if the change is significant.</p>`,
  );

export const termsPage = (site: SiteInfo) =>
  page(
    "Terms of service · Tick & Taka",
    `<h1>Terms of service</h1>
<p class="muted">Last updated ${UPDATED}</p>
<p>These terms apply when you use Tick &amp; Taka, an app run by ${escapeHtml(site.operator)}. By signing in you agree to them. If you don't agree, please don't use the app.</p>

<h2>Your account</h2>
<p>You sign in with a Google account and are responsible for what happens under it. Keep your phone and Google account secure.</p>

<h2>Your data</h2>
<p>What you put in the app stays yours. You let us store and process it only to run the app for you, as the <a href="/privacy">privacy policy</a> explains. You can export it or ask us to delete it at any time.</p>

<h2>Acceptable use</h2>
<p>Don't use the app to break the law, to try to reach other people's data, to overload or attack the service, or to misuse the AI features (for example by sending content meant to harm others).</p>

<h2>AI features</h2>
<p>Tiki and the other AI features can misunderstand or make mistakes. Check what they add or change; every change can be undone, and nothing is deleted without your confirmation. AI answers about money are not financial advice. We may limit how much AI each account can use.</p>

<h2>Not financial advice</h2>
<p>Budgets, "safe to spend" and reports are tools to help you see your own numbers. They are not financial, tax or legal advice, and you remain responsible for your decisions.</p>

<h2>The service</h2>
<p>The app is provided "as is". We work to keep it running and your data safe, but we can't promise it will always be available or free of errors, and we may change or stop features. Keep your own exports of anything important.</p>

<h2>Liability</h2>
<p>To the extent the law allows, we are not liable for indirect or consequential losses, or for losses caused by mistakes in data you enter or in AI suggestions you accept.</p>

<h2>Ending</h2>
<p>You can stop using the app and ask us to delete your account at any time. We may suspend accounts that break these terms.</p>

<h2>Changes and contact</h2>
<p>We may update these terms and will change the date above when we do. Questions: ${contact(site)}.</p>`,
  );
