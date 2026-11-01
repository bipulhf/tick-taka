import type { WidgetCache, WidgetTask } from "../../src/features/widget/widget-cache";

export const task = (id: string, overrides: Partial<WidgetTask> = {}): WidgetTask => ({
  id,
  title: id,
  status: "open",
  done: false,
  at: null,
  doAt: null,
  top: false,
  ...overrides,
});

/** A signed-in widget cache for 1 Nov 2026, Dhaka (built here: the store needs a phone). */
export function sampleCache(overrides: Partial<WidgetCache> = {}): WidgetCache {
  return {
    signedIn: true,
    date: "2026-11-01",
    timeZone: "Asia/Dhaka",
    leftTodayMinor: 50_000,
    spentTodayMinor: 10_000,
    dailyMinor: 60_000,
    tasks: [],
    earlier: [],
    tomorrowCount: 0,
    habits: [],
    bills: [],
    billsLeftMinor: 0,
    month: null,
    focusMinutes: 25,
    focus: null,
    accountId: "cash",
    accounts: [
      { id: "cash", name: "Cash", currency: "BDT" },
      { id: "bkash", name: "bKash", currency: "BDT" },
    ],
    currency: "BDT",
    quick: [{ label: "Cha", note: "cha", amountMinor: 2_000, categoryId: null, emoji: "☕" }],
    status: null,
    undo: null,
    numerals: "latn",
    hidden: false,
    assistant: true,
    updatedAt: 0,
    ...overrides,
  };
}
