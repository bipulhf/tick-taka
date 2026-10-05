import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ParsedSms } from "@tick-taka/shared/sms";
import { createStore, useStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";

export type CardKind = "expense" | "income" | "transfer";

export interface SmsCard {
  fingerprint: string;
  sender: string;
  /** Raw text stays on the phone; the server never sees it. */
  body: string;
  receivedAt: number;
  parsed: ParsedSms;
  kind: CardKind;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  /** Category came from a learned rule or keyword, so "Add all" can include it. */
  confident: boolean;
  aiParsed: boolean;
  status: "pending" | "added" | "ignored";
  ignoredAt: number | null;
  transactionId: string | null;
}

const KEY = "tt.sms-cards";
const IGNORED_KEEP_MS = 30 * 86_400_000;

export const smsCardsStore = createStore<SmsCard[]>([]);
resetOnSignOut(() => smsCardsStore.set([]));

export async function loadSmsCards() {
  const raw = await AsyncStorage.getItem(KEY);
  const cards = raw ? (JSON.parse(raw) as SmsCard[]) : [];
  const cutoff = Date.now() - IGNORED_KEEP_MS;
  // Ignored cards stay undoable for 30 days; added ones are only kept for a week.
  smsCardsStore.set(
    cards.filter((c) =>
      c.status === "ignored"
        ? (c.ignoredAt ?? 0) > cutoff
        : c.status === "pending" || c.receivedAt > Date.now() - 7 * 86_400_000,
    ),
  );
}

function save(cards: SmsCard[]) {
  smsCardsStore.set(cards);
  void AsyncStorage.setItem(KEY, JSON.stringify(cards));
}

export function addCards(cards: SmsCard[]) {
  const known = new Set(smsCardsStore.get().map((c) => c.fingerprint));
  const fresh = cards.filter((c) => !known.has(c.fingerprint));
  if (fresh.length)
    save([...smsCardsStore.get(), ...fresh].sort((a, b) => b.receivedAt - a.receivedAt));
}

export function updateCard(fingerprint: string, patch: Partial<SmsCard>) {
  save(smsCardsStore.get().map((c) => (c.fingerprint === fingerprint ? { ...c, ...patch } : c)));
}

export const useSmsCards = () => useStore(smsCardsStore);
