import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "../src/dates";
import { parseQuickAdd, type QuickAddContext } from "../src/quick-add";

/*
 * Table-driven quick-add cases: the spec's examples plus the false positives from
 * QA-011 (Bangla digits) and QA-012 ("weekly" as an adjective, stray numbers as
 * expenses). Each row is [typed text, fields the draft must have].
 */

const TZ = "Asia/Dhaka";
// Sunday 4 October 2026, 10:00 in Dhaka
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, TZ);
const tomorrowAt = (hour: number) => zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour }, TZ);

const context: QuickAddContext = {
  now,
  timeZone: TZ,
  accounts: [
    { id: "acc_cash", name: "Cash", type: "cash" },
    { id: "acc_bkash", name: "bKash", type: "mobile_wallet" },
    { id: "acc_nagad", name: "Nagad", type: "mobile_wallet" },
    { id: "acc_bank", name: "City Bank", type: "bank" },
  ],
  defaultAccountId: "acc_cash",
  categories: [
    { id: "cat_food", name: "Food", kind: "expense", parentId: null },
    { id: "cat_eatout", name: "Eating out", kind: "expense", parentId: "cat_food" },
    { id: "cat_groceries", name: "Groceries", kind: "expense", parentId: "cat_food" },
    { id: "cat_transport", name: "Transport", kind: "expense", parentId: null },
    { id: "cat_shopping", name: "Shopping", kind: "expense", parentId: null },
    { id: "cat_health", name: "Health", kind: "expense", parentId: null },
    { id: "cat_rent", name: "Rent", kind: "expense", parentId: null },
    { id: "cat_bills", name: "Bills", kind: "expense", parentId: null },
    { id: "cat_gifts", name: "Gifts", kind: "expense", parentId: null },
    { id: "cat_salary", name: "Salary", kind: "income", parentId: null },
    { id: "cat_freelance", name: "Freelance", kind: "income", parentId: null },
  ],
  areas: [
    { id: "area_research", name: "Research" },
    { id: "area_teaching", name: "Teaching" },
    { id: "area_personal", name: "Personal" },
  ],
  rules: [],
};

type Row = [string, Record<string, unknown>];

const expense = (amountMinor: number, extra: Record<string, unknown> = {}) => ({
  kind: "expense",
  amountMinor,
  ...extra,
});
const income = (amountMinor: number, extra: Record<string, unknown> = {}) => ({
  kind: "income",
  amountMinor,
  ...extra,
});
const task = (title: string, extra: Record<string, unknown> = {}) => ({
  kind: "task",
  title,
  ...extra,
});
const time = (minutes: number, extra: Record<string, unknown> = {}) => ({
  kind: "time_entry",
  minutes,
  ...extra,
});

const ENGLISH: Row[] = [
  // Spec examples
  ["cha 20", expense(2_000, { categoryId: "cat_food", accountId: "acc_cash", confidence: "high" })],
  ["lunch 250", expense(25_000, { categoryId: "cat_food", note: "lunch", confidence: "high" })],
  ["+45000 salary", income(4_500_000, { categoryId: "cat_salary", confidence: "high" })],
  [
    "call bank tomorrow 5pm",
    task("Call bank", { doAt: tomorrowAt(17), hasTime: true, reminderAt: tomorrowAt(17) }),
  ],
  ["2h thesis", time(120, { note: "thesis", areaId: "area_research", confidence: "high" })],
  ["2h thesis writing", time(120, { note: "thesis writing", areaId: "area_research" })],
  [
    "rickshaw 60 bkash",
    expense(6_000, { categoryId: "cat_transport", accountId: "acc_bkash", note: "rickshaw" }),
  ],
  [
    "biryani with friends 850",
    expense(85_000, { categoryId: "cat_food", note: "biryani with friends", confidence: "high" }),
  ],
  ["dinner 1850/3", expense(61_700, { categoryId: "cat_food" })],
  // More money
  ["250 lunch", expense(25_000, { categoryId: "cat_food", note: "lunch" })],
  ["bkash lunch 250", expense(25_000, { accountId: "acc_bkash", note: "lunch" })],
  ["uber 320 nagad", expense(32_000, { categoryId: "cat_transport", accountId: "acc_nagad" })],
  ["restaurant 900", expense(90_000, { categoryId: "cat_eatout" })],
  ["milk 120", expense(12_000, { categoryId: "cat_groceries" })],
  ["buy milk 120", expense(12_000, { categoryId: "cat_groceries", note: "buy milk" })],
  ["medicine 450", expense(45_000, { categoryId: "cat_health" })],
  ["blood test 1500", expense(150_000, { categoryId: "cat_health" })],
  ["internet bill 1200", expense(120_000, { categoryId: "cat_bills" })],
  ["wedding gift 3000", expense(300_000, { categoryId: "cat_gifts" })],
  ["bus ticket 500", expense(50_000, { categoryId: "cat_transport" })],
  ["+15000 upwork", income(1_500_000, { categoryId: "cat_freelance" })],
  ["45000 salary", income(4_500_000, { categoryId: "cat_salary" })],
  ["lunch 1,250", expense(125_000)],
  ["lunch 99.50", expense(9_950)],
  ["lunch 250tk", expense(25_000, { note: "lunch" })],
  ["Tk 250 lunch", expense(25_000, { note: "lunch" })],
  ["৳300 gift", expense(30_000, { categoryId: "cat_gifts", note: "gift" })],
  ["300 bkash", expense(30_000, { accountId: "acc_bkash" })],
  ["250", expense(25_000, { note: "", confidence: "low" })],
  ["zxcv 120", expense(12_000, { categoryId: null, confidence: "low" })],
  ["pizza 600+150", expense(75_000, { categoryId: "cat_eatout" })],
  // Tasks that must stay tasks (QA-012)
  ["read weekly report", task("Read weekly report", { rrule: null })],
  ["submit weekly report", task("Submit weekly report", { rrule: null })],
  ["pay monthly rent", task("Pay monthly rent", { rrule: null })],
  ["prepare the annually audited accounts", task("Prepare the annually audited accounts")],
  ["read chapter 5", task("Read chapter 5")],
  ["room 302 meeting", task("Room 302 meeting")],
  ["lecture 3 prep", task("Lecture 3 prep")],
  ["grade quiz 4", task("Grade quiz 4")],
  ["fix issue 42", task("Fix issue 42")],
  ["3 slides for class", task("3 slides for class")],
  ["call 01712345678", task("Call 01712345678")],
  ["refresh portfolio", task("Refresh portfolio", { doAt: null, confidence: "high" })],
  ["meet supervisor at 3", task("Meet supervisor", { hasTime: true })],
  // Repeats
  ["every week call mom", task("Call mom", { rrule: "FREQ=WEEKLY", confidence: "high" })],
  ["call mom every week", task("Call mom", { rrule: "FREQ=WEEKLY" })],
  ["water plants every 3 days", task("Water plants", { rrule: "FREQ=DAILY;INTERVAL=3" })],
  ["water plants repeat weekly", task("Water plants", { rrule: "FREQ=WEEKLY" })],
  ["backup photos recurring monthly", task("Backup photos", { rrule: "FREQ=MONTHLY" })],
  ["daily standup", task("Daily standup", { rrule: "FREQ=DAILY", confidence: "low" })],
  ["weekly review", task("Weekly review", { rrule: "FREQ=WEEKLY", confidence: "low" })],
  ["pay rent monthly", task("Pay rent monthly", { rrule: "FREQ=MONTHLY", confidence: "low" })],
  [
    "lab class every Sun and Tue 10am",
    task("Lab class", { rrule: "FREQ=WEEKLY;BYDAY=SU,TU;BYHOUR=10;BYMINUTE=0", hasTime: true }),
  ],
  // Time entries
  ["45m reading", time(45, { areaId: "area_personal" })],
  ["1h30m grading", time(90, { areaId: "area_teaching" })],
  ["1.5h research", time(90, { areaId: "area_research" })],
];

const BANGLA: Row[] = [
  ["চা ২০", expense(2_000, { categoryId: "cat_food", note: "চা", confidence: "high" })],
  ["চা ২০ টাকা", expense(2_000, { categoryId: "cat_food", note: "চা" })],
  ["৳২০ চা", expense(2_000, { categoryId: "cat_food", note: "চা" })],
  ["নাস্তা ৮০", expense(8_000, { categoryId: "cat_food" })],
  ["বিরিয়ানি ৩৫০", expense(35_000, { categoryId: "cat_food" })],
  ["বাজার ১২০০", expense(120_000, { categoryId: "cat_groceries" })],
  ["চাল ৫০০", expense(50_000, { categoryId: "cat_groceries" })],
  ["রিকশা ৬০", expense(6_000, { categoryId: "cat_transport", note: "রিকশা" })],
  ["সিএনজি ২৫০ নগদ", expense(25_000, { categoryId: "cat_transport", accountId: "acc_nagad" })],
  ["চা ২০ বিকাশ", expense(2_000, { categoryId: "cat_food", accountId: "acc_bkash", note: "চা" })],
  ["বাসা ভাড়া ১৫০০০", expense(1_500_000, { categoryId: "cat_rent" })],
  ["ওষুধ ৪৫০", expense(45_000, { categoryId: "cat_health" })],
  ["বিদ্যুৎ বিল ১২০০", expense(120_000, { categoryId: "cat_bills" })],
  ["+৪৫০০০ বেতন", income(4_500_000, { categoryId: "cat_salary" })],
  ["৪৫০০০ বেতন", income(4_500_000, { categoryId: "cat_salary" })],
  ["১৮৫০/৩", expense(61_700)],
  ["জিনিস ২০০", expense(20_000, { categoryId: null, confidence: "low" })],
  ["২ ঘণ্টা থিসিস", time(120, { note: "থিসিস" })],
  ["৪৫ মিনিট পড়া", time(45)],
  ["মাকে ফোন করা", task("মাকে ফোন করা", { confidence: "low" })],
  ["রুম ৩০২ মিটিং", task("রুম ৩০২ মিটিং", { confidence: "low" })],
  ["অধ্যায় ৫ পড়া", task("অধ্যায় ৫ পড়া")],
  ["পড়া অধ্যা\u09DF ৫", task("পড়া অধ্যা\u09DF ৫")],
  ["পড়া অধ্যায\u09BC ৫", task("পড়া অধ্যায\u09BC ৫")],
  ["৩ নম্বর প্রশ্ন", task("৩ নম্বর প্রশ্ন")],
];

const MIXED: Row[] = [
  ["lunch ২৫০", expense(25_000, { categoryId: "cat_food", note: "lunch" })],
  ["রিকশা ৬০ bkash", expense(6_000, { categoryId: "cat_transport", accountId: "acc_bkash" })],
  ["cha ২০ tk", expense(2_000, { categoryId: "cat_food", note: "cha" })],
  ["বাজার 1200 bkash", expense(120_000, { categoryId: "cat_groceries", accountId: "acc_bkash" })],
  ["+৪৫০০০ salary", income(4_500_000, { categoryId: "cat_salary" })],
  ["dinner ১৮৫০/৩", expense(61_700, { categoryId: "cat_food" })],
  ["২h thesis", time(120, { note: "thesis", areaId: "area_research" })],
  ["১h৩০m grading", time(90, { areaId: "area_teaching" })],
  ["call bank tomorrow ৫pm", task("Call bank", { doAt: tomorrowAt(17), hasTime: true })],
  ["water plants every ৩ days", task("Water plants", { rrule: "FREQ=DAILY;INTERVAL=3" })],
  ["read chapter ৫", task("Read chapter ৫")],
  ["thesis meeting রুম ৩০২", task("Thesis meeting রুম ৩০২", { confidence: "low" })],
];

describe("quick-add table: English", () => {
  test.each(ENGLISH)("%s", (text, expected) => {
    expect(parseQuickAdd(text, context)).toMatchObject(expected);
  });
});

describe("quick-add table: Bangla", () => {
  test.each(BANGLA)("%s", (text, expected) => {
    expect(parseQuickAdd(text, context)).toMatchObject(expected);
  });
});

describe("quick-add table: mixed Bangla and English", () => {
  test.each(MIXED)("%s", (text, expected) => {
    expect(parseQuickAdd(text, context)).toMatchObject(expected);
  });
});

describe("forced kinds still read a labelled number as the amount", () => {
  test("the Expense chip wins over the label heuristic", () => {
    expect(parseQuickAdd("read chapter 5", context, "expense")).toMatchObject(expense(500));
    expect(parseQuickAdd("3 slides for class", context, "expense")).toMatchObject(expense(300));
  });
});
