import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Numerals } from "@tick-taka/shared/money";
import type { OutboxRequest } from "@/lib/outbox-policy";
import { afterHandOver } from "./widget-pending";

export interface QuickEntry {
  label: string;
  note: string;
  amountMinor: number;
  categoryId: string | null;
  /** The category's emoji, shown on the chip ("☕ Cha ৳20"). */
  emoji?: string | null;
}

/** A task as the widgets show it: today's, or one left from an earlier day. */
export interface WidgetTask {
  id: string;
  title: string;
  /** Its status before a tick, so Undo can put it back (inbox or open). */
  status: string;
  done: boolean;
  /** When it is planned for, if it has a time. */
  at: number | null;
  doAt: number | null;
  /** One of today's top three. */
  top: boolean;
}

export interface WidgetHabit {
  id: string;
  name: string;
  emoji: string;
  count: number;
  target: number;
  streak: number;
}

/** A bill to pay, or income to receive. */
export interface WidgetBill {
  id: string;
  name: string;
  income: boolean;
  amountMinor: number;
  currency: string;
  accountId: string | null;
  /** Local date it is due (YYYY-MM-DD), and next_due_at itself (what "Paid" pays). */
  dueDate: string;
  dueAt: number;
  overdue: boolean;
  /** Counted in "still to pay": a bill due by the end of this month. */
  thisMonth: boolean;
}

export interface WidgetMonth {
  /** YYYY-MM. */
  month: string;
  inMinor: number;
  outMinor: number;
  budgetLimitMinor: number;
  budgetSpentMinor: number;
  /** The category with the most spent this month. */
  top: { name: string; emoji: string; amountMinor: number } | null;
}

/** A focus session running now, started on the widget or in the app. */
export interface WidgetFocus {
  entryId: string;
  startedAt: number;
  endsAt: number;
  taskId: string | null;
  title: string | null;
}

/**
 * What a widget tap can take back for a few seconds: the writes it queued or sent
 * (by request id), the writes that reverse them, and the cache fields to put back.
 */
export interface WidgetUndo {
  id: string;
  /** The widget it was tapped on: only that kind shows the Undo strip. */
  widget: string;
  text: string;
  at: number;
  /** Still waiting on this phone (offline), not yet on the server. */
  queued: boolean;
  forward: string[];
  reverse: OutboxRequest[];
  restore: Partial<WidgetCache>;
}

/** Today in a few numbers and lists, for the home-screen widgets (widget-snapshot.ts). */
export interface WidgetCache {
  /** False until a signed-in app has written today's numbers. */
  signedIn: boolean;
  /** The local day these numbers are for (YYYY-MM-DD), and the user's time zone. */
  date: string;
  timeZone: string;
  leftTodayMinor: number | null;
  spentTodayMinor: number;
  dailyMinor: number;
  /** Today's tasks, top three first. */
  tasks: WidgetTask[];
  /** Open tasks from earlier days, oldest first. */
  earlier: WidgetTask[];
  tomorrowCount: number;
  habits: WidgetHabit[];
  bills: WidgetBill[];
  billsLeftMinor: number;
  month: WidgetMonth | null;
  /** Settings › Focus: how long a focus period is. */
  focusMinutes: number;
  focus: WidgetFocus | null;
  /** The account quick-logs and bills go through when they don't name one. */
  accountId: string | null;
  /** Live accounts; null until the app has loaded them. */
  accounts: { id: string; name: string; currency: string }[] | null;
  currency: string;
  quick: QuickEntry[];
  status: string | null;
  undo: WidgetUndo | null;
  /** Digits amounts are shown in (Settings › Appearance › Numbers). */
  numerals: Numerals;
  /** Hide amounts is on: the widget shows "৳•••" for every figure. */
  hidden: boolean;
  /** Tiki can answer: the server's AI is set up and the chat is switched on. */
  assistant: boolean;
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

/** A write made on the widget while offline, waiting for the app to send it. */
export interface PendingWidgetRequest {
  id: string;
  request: OutboxRequest;
}

const CACHE_KEY = "tt.widget";
const PENDING_KEY = "tt.widget-pending";
const PENDING_DELETES_KEY = "tt.widget-pending-deletes";
const PENDING_REQUESTS_KEY = "tt.widget-pending-requests";

export const EMPTY_CACHE: WidgetCache = {
  signedIn: false,
  date: "",
  timeZone: "Asia/Dhaka",
  leftTodayMinor: null,
  spentTodayMinor: 0,
  dailyMinor: 0,
  tasks: [],
  earlier: [],
  tomorrowCount: 0,
  habits: [],
  bills: [],
  billsLeftMinor: 0,
  month: null,
  focusMinutes: 25,
  focus: null,
  accountId: null,
  accounts: null,
  currency: "BDT",
  quick: [],
  status: null,
  undo: null,
  numerals: "latn",
  hidden: false,
  // Until the app has said the AI is on, the widget doesn't offer a chat that can't answer.
  assistant: false,
  updatedAt: 0,
};

/**
 * A stored cache read back safely: only known fields, each of the right kind. An
 * older build stored `habits` as two counts, which would break a list. Pure.
 */
export function parseCache(raw: string | null): WidgetCache {
  if (!raw) return EMPTY_CACHE;
  let stored: Record<string, unknown>;
  try {
    stored = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return EMPTY_CACHE;
  }
  const cache: Record<string, unknown> = { ...EMPTY_CACHE };
  for (const [key, empty] of Object.entries(EMPTY_CACHE)) {
    const value = stored[key];
    if (value === undefined) continue;
    const sameKind = Array.isArray(empty)
      ? Array.isArray(value)
      : empty === null || value === null || typeof value === typeof empty;
    if (sameKind) cache[key] = value;
  }
  return cache as unknown as WidgetCache;
}

export async function readWidgetCache(): Promise<WidgetCache> {
  return parseCache(await AsyncStorage.getItem(CACHE_KEY));
}

export async function writeWidgetCache(cache: WidgetCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Quick-logs tapped while offline by an older build; the app sends them on next open. */
export async function readPendingLogs(): Promise<PendingWidgetLog[]> {
  return JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? "[]") as PendingWidgetLog[];
}

async function writePendingLogs(logs: PendingWidgetLog[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(logs));
}

/** Quick-logs undone while offline by an older build; the app deletes them on next open. */
export async function readPendingDeletes(): Promise<string[]> {
  return JSON.parse((await AsyncStorage.getItem(PENDING_DELETES_KEY)) ?? "[]") as string[];
}

async function writePendingDeletes(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids));
}

/** Writes tapped on a widget while offline, in order; the app sends them on next open. */
export async function readPendingRequests(): Promise<PendingWidgetRequest[]> {
  return JSON.parse(
    (await AsyncStorage.getItem(PENDING_REQUESTS_KEY)) ?? "[]",
  ) as PendingWidgetRequest[];
}

export async function writePendingRequests(requests: PendingWidgetRequest[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(requests));
}

/** Drops the widget logs the app just queued, re-reading so a tap made meanwhile stays. */
export async function removePendingLogs(sent: PendingWidgetLog[]): Promise<void> {
  await writePendingLogs(afterHandOver(await readPendingLogs(), sent, (log) => log.id));
}

/** Drops the widget deletes the app just queued, keeping any made meanwhile. */
export async function removePendingDeletes(sent: string[]): Promise<void> {
  await writePendingDeletes(afterHandOver(await readPendingDeletes(), sent, (id) => id));
}

/** Drops the widget writes the app just queued, keeping any made meanwhile. */
export async function removePendingRequests(sent: PendingWidgetRequest[]): Promise<void> {
  await writePendingRequests(
    afterHandOver(await readPendingRequests(), sent, (pending) => pending.id),
  );
}

/** Widget writes still waiting for the app, for the sign-out warning. */
export async function countPendingWidgetWrites(): Promise<number> {
  const [logs, deletes, requests] = await Promise.all([
    readPendingLogs(),
    readPendingDeletes(),
    readPendingRequests(),
  ]);
  return logs.length + deletes.length + requests.length;
}

/**
 * The most frequent "note + amount" expenses become one-tap chips ("☕ Cha ৳20"):
 * logged at least twice, most often first.
 */
export function pickQuickEntries(
  transactions: {
    type: string;
    note: string | null;
    amountMinor: number;
    categoryId: string | null;
  }[],
  limit = 3,
  emojiOf: (categoryId: string | null) => string | null = () => null,
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
          emoji: emojiOf(tx.categoryId),
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
