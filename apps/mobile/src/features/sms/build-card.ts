import { guessCategory, type QuickAddContext } from "@tick-taka/shared/quick-add";
import type { Settings } from "@tick-taka/shared/schemas/settings";
import type { ParsedSms } from "@tick-taka/shared/sms";
import type { SmsCard } from "./sms-store";

/**
 * Wording to records: received → income, payment/debit → expense, cash out → a
 * transfer from the wallet to Cash with the fee on it.
 */
export function buildCard(input: {
  fingerprint: string;
  sender: string;
  body: string;
  receivedAt: number;
  parsed: ParsedSms;
  accountId: string;
  settings: Settings;
  context: QuickAddContext;
  aiParsed: boolean;
}): SmsCard {
  const { parsed } = input;
  const note = parsed.counterparty ?? input.sender;
  const kind =
    parsed.direction === "in" ? "income" : parsed.direction === "cash_out" ? "transfer" : "expense";
  const guess =
    kind === "transfer" ? { categoryId: null, kind: null } : guessCategory(note, input.context);
  const categoryId = guess.kind === null || guess.kind === kind ? guess.categoryId : null;
  return {
    fingerprint: input.fingerprint,
    sender: input.sender,
    body: input.body,
    receivedAt: input.receivedAt,
    parsed,
    kind,
    accountId: input.accountId,
    toAccountId: kind === "transfer" ? input.settings.cashAccountId : null,
    categoryId,
    note,
    confident: kind === "transfer" ? Boolean(input.settings.cashAccountId) : categoryId !== null,
    aiParsed: input.aiParsed,
    status: "pending",
    ignoredAt: null,
    transactionId: null,
  };
}
