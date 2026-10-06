import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Numerals } from "@tick-taka/shared/money";

export interface QuickEntry {
  label: string;
  note: string;
  amountMinor: number;
  categoryId: string | null;
}

/** The last quick-log tapped on the widget, which the widget offers to undo for a while. */
export interface LastWidgetLog {
  id: string;
  label: string;
  amountMinor: number;
  at: number;
  /** Still waiting on this phone (offline), not yet on the server. */
  queued: boolean;
}

/** Today in a few numbers, for the home-screen widget (see widget-snapshot.ts). */
export interface WidgetCache {
  /** False until a signed-in app has written today's numbers. */
  signedIn: boolean;
  leftTodayMinor: number | null;
  spentTodayMinor: number;
  dailyMinor: number;
  nextUp: { title: string; when: string } | null;
  topThree: { done: number; total: number };
  habits: { done: number; total: number };
  accountId: string | null;
  quick: QuickEntry[];
  status: string | null;
  lastLog: LastWidgetLog | null;
  /** Digits amounts are shown in (Settings › Appearance › Numbers). */
  numerals: Numerals;
  updatedAt: number;
}

export interface PendingWidgetLog {
  id: string;
  note: string;
  amountMinor: number;
  categoryId: string | null;
  accountId: string;
  occurredAt: number;
}

const CACHE_KEY = "tt.widget";
const PENDING_KEY = "tt.widget-pending";
const PENDING_DELETES_KEY = "tt.widget-pending-deletes";

export const EMPTY_CACHE: WidgetCache = {
  signedIn: false,
  leftTodayMinor: null,
  spentTodayMinor: 0,
  dailyMinor: 0,
  nextUp: null,
  topThree: { done: 0, total: 0 },
  habits: { done: 0, total: 0 },
  accountId: null,
  quick: [],
  status: null,
  lastLog: null,
  numerals: "latn",
  updatedAt: 0,
};

export async function readWidgetCache(): Promise<WidgetCache> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  return raw ? { ...EMPTY_CACHE, ...(JSON.parse(raw) as WidgetCache) } : EMPTY_CACHE;
}

export async function writeWidgetCache(cache: WidgetCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Logs tapped on the widget while offline; the app sends them on next open. */
export async function readPendingLogs(): Promise<PendingWidgetLog[]> {
  return JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? "[]") as PendingWidgetLog[];
}

export async function writePendingLogs(logs: PendingWidgetLog[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(logs));
}

/** Widget logs undone while offline; the app deletes them on next open. */
export async function readPendingDeletes(): Promise<string[]> {
  return JSON.parse((await AsyncStorage.getItem(PENDING_DELETES_KEY)) ?? "[]") as string[];
}

export async function writePendingDeletes(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids));
}

/** The three most frequent "note + amount" expenses become one-tap buttons (e.g. "cha ৳20"). */
export function pickQuickEntries(
  transactions: {
    type: string;
    note: string | null;
    amountMinor: number;
    categoryId: string | null;
  }[],
  limit = 3,
): QuickEntry[] {
  const counts = new Map<string, { entry: QuickEntry; count: number }>();
  for (const tx of transactions) {
    if (tx.type !== "expense" || !tx.note || tx.note.length > 18) continue;
    const key = `${tx.note.toLowerCase()}|${tx.amountMinor}`;
    const current = counts.get(key);
    if (current) current.count++;
    else
      counts.set(key, {
        entry: {
          label: tx.note,
          note: tx.note,
          amountMinor: tx.amountMinor,
          categoryId: tx.categoryId,
        },
        count: 1,
      });
  }
  return [...counts.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => c.entry);
}
