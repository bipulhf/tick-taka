import {
  getMessagesSince,
  hasSmsPermission,
  type RawSms,
  setAllowedSenders,
} from "@modules/sms-reader";
import { onlineManager } from "@tanstack/react-query";
import type { AnyDraft, QuickAddContext } from "@tick-taka/shared/quick-add";
import type { Settings } from "@tick-taka/shared/schemas/settings";
import { isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { maskSms, type ParsedSms, parseWithTemplates, smsFingerprint } from "@tick-taka/shared/sms";
import { api, send, unwrap } from "@/lib/api";
import { buildCard } from "./build-card";
import { addCards, type SmsCard, smsCardsStore } from "./sms-store";

let scanning = false;

async function aiFallback(message: RawSms): Promise<ParsedSms | null> {
  try {
    // Only the masked text leaves the phone.
    const result = await unwrap(
      api.ai.parse.$post({
        json: { text: maskSms(message.body), sms: true, sender: message.sender },
      }),
    );
    const draft = result.draft as AnyDraft;
    if (!("amountMinor" in draft) || draft.amountMinor === null) return null;
    const direction =
      draft.kind === "income"
        ? "in"
        : draft.kind === "transfer"
          ? "cash_out"
          : draft.kind === "expense"
            ? "out"
            : null;
    if (!direction) return null;
    return {
      amountMinor: draft.amountMinor,
      direction,
      feeMinor: draft.kind === "transfer" ? draft.feeMinor : 0,
      balanceAfterMinor: result.sms?.balanceAfterMinor ?? null,
      transactionRef: result.sms?.transactionRef ?? null,
      counterparty: "note" in draft && draft.note ? draft.note : null,
    };
  } catch {
    return null;
  }
}

/**
 * Scan: read allowed messages since the last scan, parse with each sender's
 * templates (AI fallback when none match), drop fingerprints the server already
 * knows, and add the rest as pending cards. Nothing becomes a transaction here.
 */
export async function scanSms(
  settings: Settings,
  context: QuickAddContext,
  accounts: { id: string; currency: string }[],
): Promise<SmsCard[]> {
  const sources = settings.smsSources;
  setAllowedSenders(sources.map((s) => s.sender));
  if (scanning || sources.length === 0 || !hasSmsPermission()) return [];
  scanning = true;
  try {
    const since = settings.smsLastScanAt || Date.now() - 3 * 86_400_000;
    const messages = await getMessagesSince(
      since,
      sources.map((s) => s.sender),
    );
    return await ingest(messages, settings, context, accounts);
  } finally {
    scanning = false;
  }
}

export async function ingest(
  messages: RawSms[],
  settings: Settings,
  context: QuickAddContext,
  accounts: { id: string; currency: string }[],
): Promise<SmsCard[]> {
  if (messages.length === 0) return [];
  const aiAllowed = isAiFeatureEnabled(settings, "parse") && onlineManager.isOnline();
  const local = new Set(smsCardsStore.get().map((c) => c.fingerprint));
  const cards: SmsCard[] = [];
  for (const message of messages) {
    const source = settings.smsSources.find(
      (s) =>
        s.sender.toLowerCase().replace(/[^a-z0-9]/g, "") ===
        message.sender.toLowerCase().replace(/[^a-z0-9]/g, ""),
    );
    if (!source) continue;
    const currency = accounts.find((a) => a.id === source.accountId)?.currency ?? "BDT";
    let parsed = parseWithTemplates(message.body, source.templates, currency);
    let aiParsed = false;
    if (!parsed && aiAllowed) {
      parsed = await aiFallback(message);
      aiParsed = parsed !== null;
    }
    if (!parsed) continue;
    const fingerprint = smsFingerprint({
      sender: message.sender,
      receivedAt: message.receivedAt,
      amountMinor: parsed.amountMinor,
      transactionRef: parsed.transactionRef,
    });
    if (local.has(fingerprint)) continue;
    cards.push(
      buildCard({
        fingerprint,
        sender: source.sender,
        body: message.body,
        receivedAt: message.receivedAt,
        parsed,
        accountId: source.accountId,
        settings,
        context,
        aiParsed,
      }),
    );
  }
  let fresh = cards;
  if (cards.length && onlineManager.isOnline()) {
    try {
      const result = await send<{ known: { fingerprint: string }[] }>("POST", "/sms-imports", {
        items: cards.map((c) => ({
          fingerprint: c.fingerprint,
          sender: c.sender,
          receivedAt: c.receivedAt,
          amountMinor: c.parsed.amountMinor,
          direction: c.parsed.direction,
        })),
      });
      const known = new Set(result.known.map((k) => k.fingerprint));
      fresh = cards.filter((c) => !known.has(c.fingerprint));
    } catch {
      // Offline or server error: keep the cards; the server dedupes on the next scan.
    }
  }
  addCards(fresh);
  const latest = Math.max(settings.smsLastScanAt, ...messages.map((m) => m.receivedAt));
  if (latest > settings.smsLastScanAt)
    void send("PATCH", "/settings", { smsLastScanAt: latest }).catch(() => {});
  return fresh;
}
