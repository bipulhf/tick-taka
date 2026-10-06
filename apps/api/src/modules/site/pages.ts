import { APP_NAME, contact, escapeHtml, page, type SiteInfo } from "./layout";

const UPDATED = "7 October 2026";

export const landingPage = (site: SiteInfo) =>
  page(
    `${APP_NAME}: a personal planner and money tracker`,
    `<h1>${APP_NAME}</h1>
<p><strong>${APP_NAME} is a personal planner and money tracker for Android.</strong> It helps one person plan their day and keep track of their own money in one app, in Bangla or English. This page explains what the app does; you don't need an account to read it.</p>

<h2>What ${APP_NAME} is for</h2>
<p>Most people keep their to-do list in one app and their spending in another. ${APP_NAME} puts both in one place, so you can see each day what you have to do and how much you can safely spend.</p>
<div class="card">
<ul>
  <li><strong>Plan your day:</strong> tasks with dates and reminders, a "top three" for each day, projects, habits with streaks, morning and evening routines, and a focus timer.</li>
  <li><strong>Track your money:</strong> record expenses and income across cash, bank accounts and mobile wallets such as bKash; set monthly budgets and see a daily "safe to spend" amount; track bills, savings goals and money you lent or borrowed.</li>
  <li><strong>Review:</strong> weekly and monthly reviews and simple reports on where your time and money went.</li>
  <li><strong>Tiki, the assistant (optional):</strong> type or speak, for example "spent 120 on rickshaw", and Tiki adds or changes records for you. It always asks before deleting anything, and AI can be switched off.</li>
  <li><strong>Home-screen widget:</strong> today's safe-to-spend amount and next task, with one-tap buttons.</li>
</ul>
</div>

<h2>Why it asks you to sign in with Google</h2>
<p>${APP_NAME} uses Google Sign-In only to know who you are, so your planner and money records are kept in your own private space on our server and you can use them on a new phone. It asks Google for your name, email address and profile picture, and nothing else: it cannot read your Gmail, Drive, contacts or any other Google data.</p>

<h2>Your privacy</h2>
<p>Your records belong to you. They are never sold, never used for advertising, and never shown to other users. You can export everything or ask us to delete your account at any time. Read the full <a href="/privacy">privacy policy</a> and the <a href="/terms">terms of service</a>.</p>

<h2>Contact</h2>
<p>${APP_NAME} is run by ${escapeHtml(site.operator)}. Questions or requests: ${contact(site)}.</p>`,
  );

export const privacyPage = (site: SiteInfo) =>
  page(
    `Privacy policy · ${APP_NAME}`,
    `<h1>Privacy policy</h1>
<p class="muted">Last updated ${UPDATED}</p>
<p>This policy explains what personal data the ${APP_NAME} Android app and its server ("${APP_NAME}", "we", "us") collect, why we collect it, how we use, store and share it, how long we keep it, and the choices you have. ${APP_NAME} is run by ${escapeHtml(site.operator)}, who is responsible for your data. Contact: ${contact(site)}.</p>

<h2>1. Data we collect</h2>
<table>
<thead><tr><th>Data</th><th>Where it comes from</th><th>Why we use it</th></tr></thead>
<tbody>
<tr><td>Name, email address and profile picture from your Google account, and Google's account ID</td><td>Google Sign-In, when you sign in</td><td>To create your account, sign you in, keep your data separate from other users' and show who is signed in</td></tr>
<tr><td>Planner records: tasks, projects, areas, habits and habit check-ins, routines, focus sessions and time entries</td><td>You, when you enter them</td><td>To provide the planner features and your reviews and reports</td></tr>
<tr><td>Money records: transactions, accounts and balances, categories, budgets, bills, savings goals, debts (including the name you give the other person), events and shopping lists</td><td>You, when you enter them</td><td>To provide the money features, budgets and reports</td></tr>
<tr><td>Receipt photos</td><td>You, if you choose to attach one</td><td>To keep the receipt with the expense and, if you use receipt scan, to read the amount</td></tr>
<tr><td>Voice recordings</td><td>Your phone's microphone, only while you hold a conversation with Tiki</td><td>To turn your speech into text; the recording is not stored</td></tr>
<tr><td>Messages to the assistant (Tiki)</td><td>You</td><td>To answer and carry out what you ask; the chat history is kept on your phone only</td></tr>
<tr><td>Settings and preferences</td><td>You</td><td>To make the app work the way you chose</td></tr>
<tr><td>AI usage records: which AI feature was used, the model, token counts and cost (not the content)</td><td>Created by our server</td><td>To show you what AI cost and to limit spending</td></tr>
<tr><td>Technical data: IP address and request times</td><td>Your phone's connection to our server</td><td>To keep the service secure and limit repeated sign-in attempts; kept only in short-lived server logs</td></tr>
</tbody>
</table>
<p>We do <strong>not</strong> collect your location, contacts, SMS messages, call logs or files, and the app contains no advertising, analytics or third-party tracking code.</p>

<h2>2. Google user data</h2>
<p>When you sign in, ${APP_NAME} requests only the basic Google scopes <code>openid</code>, <code>email</code> and <code>profile</code>. We use this information solely to authenticate you and to display your name, email and picture inside the app. We do not request access to Gmail, Google Drive, Google Calendar, contacts or any other Google service, and we do not use Google user data for advertising, sell it, or transfer it to anyone except as needed to provide the app (see section 4).</p>
<p>${APP_NAME}'s use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>3. How we use your data</h2>
<ul>
  <li>To run the app: store your records, sync them to your phone, and show your plans, balances, budgets and reports.</li>
  <li>To send the reminders and notifications you turn on (these are scheduled on your phone).</li>
  <li>To provide the optional AI features, described in section 5.</li>
  <li>To keep the service working and secure: backups, preventing abuse and fixing problems.</li>
</ul>
<p>We do not use your data for advertising, profiling or any purpose unrelated to the app, and we never sell it.</p>

<h2>4. Who we share data with</h2>
<p>We share data only with the service providers needed to run the app, and only for that purpose:</p>
<ul>
  <li><strong>Google</strong>, to sign you in.</li>
  <li><strong>OpenAI</strong>, only when you use an AI feature (section 5).</li>
  <li><strong>Our hosting and network providers</strong> (the server that stores the data, and Cloudflare, which carries traffic to it securely over HTTPS).</li>
</ul>
<p>We may also disclose data if required by law. We do not share data with any other third party.</p>

<h2>5. AI features</h2>
<p>AI features are optional. You can switch them all off, or one by one, in Settings › AI. When you use one, the data needed for that request is sent to OpenAI's API: the text you typed or the words you spoke, a receipt photo you chose to scan, the names of your accounts, categories and areas, and, for the assistant, the records it looks up to answer you. Voice recordings are converted to text and not stored by us. OpenAI processes this data to return a result; under its API terms it does not use API data to train its models by default. The assistant can add and change records only through the same checks as the app itself, and deletes nothing without your confirmation.</p>

<h2>6. Where data is stored and how it is protected</h2>
<ul>
  <li>Your records are stored on our server in a separate database file for each user, which can only be reached with your signed-in session.</li>
  <li>All data between the app and the server travels encrypted over HTTPS.</li>
  <li>The app keeps a copy on your phone so it works offline. Signing out removes it from the phone.</li>
  <li>You can lock the app with your fingerprint or face.</li>
</ul>

<h2>7. How long we keep data</h2>
<ul>
  <li>Your account and records are kept until you delete them or ask us to delete your account.</li>
  <li>When you delete a record in the app it disappears at once; it is kept marked as deleted (so Undo works) until your account is deleted.</li>
  <li>A backup copy is made each night and only the newest 14 are kept, so backups are gone within 14 days of being replaced.</li>
  <li>When you delete your account in the app, your account, records, receipt photos, backups and sign-in sessions are removed from our server at once. If you ask us by email instead, we do the same within 30 days.</li>
</ul>

<h2>8. Your rights and choices</h2>
<ul>
  <li><strong>Access and export:</strong> Settings › Your data exports all your records as one file.</li>
  <li><strong>Correct or delete records:</strong> edit or delete anything in the app at any time.</li>
  <li><strong>Delete your account:</strong> delete it from Settings in the app, which removes everything at once, or email ${contact(site)} from the email address you sign in with and we will delete everything within 30 days.</li>
  <li><strong>Revoke Google access:</strong> remove ${APP_NAME} from <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> at any time.</li>
  <li><strong>Turn off AI:</strong> Settings › AI.</li>
</ul>

<h2>9. Phone permissions</h2>
<ul>
  <li><strong>Microphone:</strong> only when you tap to talk to Tiki.</li>
  <li><strong>Notifications:</strong> for reminders you set.</li>
  <li><strong>Fingerprint or face unlock:</strong> only if you turn on the app lock; the check happens on your phone and nothing biometric reaches us.</li>
  <li><strong>Photos or camera:</strong> only when you choose to attach a receipt.</li>
</ul>

<h2>10. Children</h2>
<p>${APP_NAME} is not directed at children under 13, and we do not knowingly collect their data. If you believe a child has given us data, contact us and we will delete it.</p>

<h2>11. Changes to this policy</h2>
<p>If we change this policy we will update the date at the top of this page, and tell you in the app if the change is significant.</p>

<h2>12. Contact</h2>
<p>${escapeHtml(site.operator)} · ${contact(site)}</p>`,
  );

export const termsPage = (site: SiteInfo) =>
  page(
    `Terms of service · ${APP_NAME}`,
    `<h1>Terms of service</h1>
<p class="muted">Last updated ${UPDATED}</p>
<p>These terms apply when you use ${APP_NAME}, an app run by ${escapeHtml(site.operator)}. By signing in you agree to them. If you don't agree, please don't use the app.</p>

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
