/**
 * A demo account with a few weeks of believable data, for README screenshots.
 *
 *   DB_PATH=/tmp/tt-demo/app.db JWT_SECRET=… bun scripts/demo.ts
 *
 * Point DB_PATH at a scratch folder, never at real data. The script creates (or
 * reuses) one demo user, fills their database through the API's own routes, and
 * prints a token. A screenshot build of the app (EXPO_PUBLIC_DEMO_SIGN_IN=1) signs
 * in with it from `ticktaka://login?demoToken=<token>`.
 */
import { addDays, type LocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { createApp } from "../src/app";
import { createUserRegistry } from "../src/db/user-registry";
import { loadEnv } from "../src/env";
import { createDeps } from "../src/lib/deps";
import { issueSession } from "../src/modules/auth/session-token";

const env = loadEnv();
if (env.DB_PATH === ":memory:" || !env.DB_PATH.includes("demo"))
  throw new Error("Point DB_PATH at a scratch folder whose path contains 'demo'");

const TZ = "Asia/Dhaka";
const now = Date.now();
const users = createUserRegistry(env, () => Date.now());
const deps = createDeps({
  env,
  now: () => Date.now(),
  ai: null,
  users,
  verifyGoogle: async () => {
    throw new Error("Google sign-in isn't used by the demo script");
  },
});
const app = createApp(deps);

const { user } = users.signIn({
  sub: "readme-demo",
  email: "sadia.demo@example.com",
  name: "Sadia Rahman",
  picture: null,
});
users.data(user);
const { token } = await issueSession({ secret: env.JWT_SECRET, users, now }, user);

type Json = Record<string, unknown>;
async function call<T = Json>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await app.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as T;
  if (!response.ok)
    throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(data)}`);
  return data;
}

const today = toLocalDate(now, TZ);
const day = (offset: number): LocalDate => addDays(today, offset);
/** An instant on a local day at a local time. */
const at = (date: LocalDate, hour: number, minute = 0) => {
  const [year, month, d] = date.split("-").map(Number) as [number, number, number];
  return zonedTimeToUtc({ year, month, day: d, hour, minute }, TZ);
};
const taka = (amount: number) => Math.round(amount * 100);

const existing = await call<Json[]>("GET", "/accounts");
if (existing.length > 0) {
  console.log(token);
  process.exit(0);
}

// Accounts -----------------------------------------------------------------------
const account = async (name: string, type: string, opening: number) =>
  (await call<Json>("POST", "/accounts", { name, type, openingMinor: taka(opening) })).id as string;
const cash = await account("Cash", "cash", 3_450);
const bkash = await account("bKash", "mobile_wallet", 6_200);
const bank = await account("City Bank", "bank", 84_200);
const savings = await account("Savings", "savings", 52_000);
await call("PATCH", "/settings", { defaultAccountId: cash, cashAccountId: cash, dailyTaskGoal: 5 });

const categories = await call<{ id: string; name: string }[]>("GET", "/categories");
const cat = (name: string) => {
  const found = categories.find((c) => c.name === name);
  if (!found) throw new Error(`No category ${name}`);
  return found.id;
};
const areas = await call<{ id: string; name: string }[]>("GET", "/areas");
const area = (name: string) => {
  const found = areas.find((a) => a.name === name);
  if (!found) throw new Error(`No area ${name}`);
  return found.id;
};

// Money: three weeks of everyday spending, salary and bills -------------------------
const expense = (
  date: LocalDate,
  hour: number,
  amount: number,
  note: string,
  category: string,
  from = cash,
) =>
  call("POST", "/transactions", {
    type: "expense",
    accountId: from,
    amountMinor: taka(amount),
    categoryId: cat(category),
    note,
    occurredAt: at(date, hour),
  });
const income = (date: LocalDate, amount: number, note: string, category: string, to = bank) =>
  call("POST", "/transactions", {
    type: "income",
    accountId: to,
    amountMinor: taka(amount),
    categoryId: cat(category),
    note,
    occurredAt: at(date, 10),
  });

const monthStart = `${today.slice(0, 7)}-01` as LocalDate;
await income(monthStart, 45_000, "Salary", "Salary");
await income(day(-9), 12_000, "Logo for Bonolota", "Freelance", bkash);
await income(day(-4), 6_500, "Tuition, two students", "Teaching income", cash);
for (let offset = -20; offset <= 0; offset++) {
  const date = day(offset);
  await expense(date, 9, 20, "cha", "Food");
  // Today stays light, so the Today screen shows money left rather than a deficit.
  if (offset === 0) continue;
  if (offset % 2 === 0) await expense(date, 8, 60, "rickshaw", "Transport");
  if (offset % 3 === 0) await expense(date, 13, 180, "lunch", "Eating out", bkash);
  if (offset % 7 === -1) await expense(date, 18, 1_250, "bazar", "Groceries");
}
await expense(day(-12), 20, 850, "biryani with friends", "Eating out", bkash);
await expense(day(-6), 17, 2_400, "shirt for Eid", "Shopping", bank);
await expense(day(-3), 11, 650, "medicine", "Health");
await expense(day(-1), 19, 320, "Pathao ride", "Transport", bkash);
await call("POST", "/transactions", {
  type: "transfer",
  accountId: bank,
  toAccountId: bkash,
  amountMinor: taka(3_000),
  note: "top up",
  occurredAt: at(day(-8), 12),
});

const month = today.slice(0, 7);
await call("PUT", "/budgets", {
  month,
  budgets: [
    { categoryId: cat("Food"), limitMinor: taka(4_000), rollover: false },
    { categoryId: cat("Eating out"), limitMinor: taka(6_000), rollover: true },
    { categoryId: cat("Groceries"), limitMinor: taka(10_000), rollover: false },
    { categoryId: cat("Transport"), limitMinor: taka(2_500), rollover: false },
    { categoryId: cat("Shopping"), limitMinor: taka(8_000), rollover: false },
    { categoryId: cat("Rent"), limitMinor: taka(12_000), rollover: false },
    { categoryId: cat("Subscriptions"), limitMinor: taka(1_500), rollover: false },
  ],
});

const recurring = (body: Json) => call("POST", "/recurring", body);
await recurring({
  kind: "bill",
  name: "Rent",
  amountMinor: taka(12_000),
  accountId: bank,
  categoryId: cat("Rent"),
  rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
  nextDueAt: at(day(3), 9),
});
await recurring({
  kind: "bill",
  name: "Internet",
  amountMinor: taka(1_050),
  accountId: bkash,
  categoryId: cat("Bills"),
  rrule: "FREQ=MONTHLY;BYMONTHDAY=10",
  nextDueAt: at(day(1), 9),
});
await recurring({
  kind: "bill",
  name: "Spotify",
  amountMinor: taka(299),
  accountId: bank,
  categoryId: cat("Subscriptions"),
  rrule: "FREQ=MONTHLY;BYMONTHDAY=18",
  nextDueAt: at(day(9), 9),
});
await recurring({
  kind: "income",
  name: "Salary",
  amountMinor: taka(45_000),
  accountId: bank,
  categoryId: cat("Salary"),
  rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
  nextDueAt: at(addDays(monthStart, 31), 10),
});

const goal = async (
  name: string,
  emoji: string,
  target: number,
  saved: number,
  deadline: number,
) => {
  const id = (
    await call<Json>("POST", "/goals", {
      name,
      emoji,
      targetMinor: taka(target),
      deadline: day(deadline),
      accountId: savings,
      createTasks: false,
    })
  ).id as string;
  await call("POST", `/goals/${id}/contribute`, {
    amountMinor: taka(saved),
    fromAccountId: bank,
    occurredAt: at(day(-15), 11),
  });
};
await goal("New laptop", "💻", 120_000, 46_000, 120);
await goal("Eid gifts", "🎁", 15_000, 9_500, 40);
await goal("Emergency fund", "🛟", 100_000, 61_000, 300);

await call("POST", "/debts", {
  person: "Rafi",
  direction: "owed_to_me",
  principalMinor: taka(2_000),
  note: "concert tickets",
  occurredAt: at(day(-10), 20),
});
await call("POST", "/debts", {
  person: "Nusrat apu",
  direction: "i_owe",
  principalMinor: taka(5_000),
  dueAt: at(day(12), 12),
});

for (const [title, est] of [
  ["Eggs, 1 dozen", 160],
  ["Rice, 5 kg", 420],
  ["Hilsa", 1_100],
  ["Dishwashing liquid", 140],
] as const)
  await call("POST", "/shopping", { title, estMinor: taka(est) });

// Time: tasks, top three, habits, focus -----------------------------------------------
const task = (body: Json) => call<Json>("POST", "/tasks", { status: "open", ...body });
await task({
  title: "Finish thesis chapter 3 draft",
  areaId: area("Research"),
  priority: "high",
  doAt: at(today, 10),
  hasTime: true,
  estimateMin: 120,
  top3Date: today,
});
await task({
  title: "Send invoice to Bonolota",
  areaId: area("Job 2"),
  doAt: at(today, 0),
  estimateMin: 15,
  top3Date: today,
});
await task({
  title: "Mark quiz papers, class 9",
  areaId: area("Teaching"),
  doAt: at(today, 16, 30),
  hasTime: true,
  estimateMin: 60,
  top3Date: today,
});
await task({
  title: "Standup with design team",
  areaId: area("Job 1"),
  doAt: at(today, 11, 30),
  hasTime: true,
  estimateMin: 30,
});
await task({
  title: "Call bank about card",
  areaId: area("Home"),
  doAt: at(today, 17),
  hasTime: true,
});
await task({ title: "Pay electricity bill", areaId: area("Home"), doAt: at(today, 0) });
await task({
  title: "Buy medicine for Ammu",
  areaId: area("Home"),
  whenSlot: "evening",
  doAt: at(today, 0),
});
await task({
  title: "Review pull requests",
  areaId: area("Job 2"),
  doAt: at(day(1), 10),
  hasTime: true,
  estimateMin: 45,
});
await task({
  title: "Prepare slides for Sunday class",
  areaId: area("Teaching"),
  doAt: at(day(2), 0),
});
await task({ title: "Book bus tickets for Eid", areaId: area("Home"), doAt: at(day(4), 0) });
await task({ title: "Renew passport", areaId: area("Personal"), doAt: at(day(6), 0) });
await task({ title: "Water the plants", areaId: area("Home"), status: "inbox" });
await task({ title: "Ask Rafi about the concert money", status: "inbox" });
await task({ title: "Learn to make roshogolla", status: "someday", areaId: area("Personal") });
const done = await task({
  title: "Morning run, 3 km",
  areaId: area("Personal"),
  doAt: at(today, 6, 30),
});
await call("PATCH", `/tasks/${done.id}`, { status: "done", updatedAt: Date.now() });
const done2 = await task({
  title: "Reply to supervisor's email",
  areaId: area("Research"),
  doAt: at(today, 0),
});
await call("PATCH", `/tasks/${done2.id}`, { status: "done", updatedAt: Date.now() });

const habit = async (
  name: string,
  emoji: string,
  target: number,
  streak: number,
  todayCount: number,
) => {
  const id = (await call<Json>("POST", "/habits", { name, emoji, targetCount: target }))
    .id as string;
  for (let offset = -streak; offset < 0; offset++)
    await call("PUT", `/habits/${id}/logs/${day(offset)}`, { count: target });
  if (todayCount > 0) await call("PUT", `/habits/${id}/logs/${today}`, { count: todayCount });
};
await habit("Water", "💧", 8, 12, 5);
await habit("Read 20 pages", "📖", 1, 6, 1);
await habit("Walk", "🏃", 1, 3, 0);
await habit("No phone after 11", "🌙", 1, 9, 0);

const entry = (date: LocalDate, from: number, minutes: number, areaName: string, note: string) =>
  call("POST", "/time-entries", {
    areaId: area(areaName),
    startedAt: at(date, from),
    endedAt: at(date, from) + minutes * 60_000,
    source: "focus",
    note,
  });
for (let offset = -6; offset <= -1; offset++) {
  await entry(day(offset), 10, 150, "Job 1", "design reviews");
  await entry(day(offset), 15, 90, "Research", "thesis");
  if (offset % 2 === 0) await entry(day(offset), 18, 60, "Teaching", "class prep");
  if (offset % 3 === 0) await entry(day(offset), 21, 75, "Job 2", "client work");
}
await entry(today, 7, 50, "Research", "thesis");

console.log(token);
