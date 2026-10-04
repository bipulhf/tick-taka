import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QuickEntry {
  label: string;
  note: string;
  amountMinor: number;
  categoryId: string | null;
}

export interface WidgetCache {
  leftTodayMinor: number | null;
  accountId: string | null;
  quick: QuickEntry[];
  status: string | null;
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

export const EMPTY_CACHE: WidgetCache = {
  leftTodayMinor: null,
  accountId: null,
  quick: [],
  status: null,
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
