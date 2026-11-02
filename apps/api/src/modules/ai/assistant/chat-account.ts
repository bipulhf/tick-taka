import { toMajor } from "@tick-taka/shared/money";
import type { AssistantMessage } from "@tick-taka/shared/schemas/ai";
import type { Vocabulary } from "../context";
import { type Draft, isId } from "./records";

/**
 * What a turn's memo says about money, so the next message can build on it: the
 * account the chat's expenses and income go through ("cut from bKash" holds for
 * the rest of the chat), and each draft's id, so a draft still waiting for the
 * user's tap can be corrected instead of looked for.
 */

type Accounts = Vocabulary["accounts"];

const NOTE = /expenses and income in this chat go through “([^”]+)”/g;

/** The memo line naming the chat's account. */
export const chatAccountNote = (name: string) =>
  `expenses and income in this chat go through “${name}”`;

/** The account the chat last put money through, from the newest memo naming one. */
export function chatAccount(history: AssistantMessage[], accounts: Accounts) {
  for (let i = history.length - 1; i >= 0; i--) {
    const memo = history[i]?.memo;
    if (!memo) continue;
    const name = [...memo.matchAll(NOTE)].at(-1)?.[1]?.trim().toLowerCase();
    if (!name) continue;
    const account = accounts.find((a) => a.name.trim().toLowerCase() === name);
    // An account archived or renamed since then: fall back to the default.
    if (account) return account;
  }
  return null;
}

/** One draft for the memo: its summary, then draftId, kind, amount and account. */
function describeDraft(draft: Draft, accounts: Accounts): string {
  const { body } = draft;
  const amount = typeof body.amountMinor === "number" ? body.amountMinor : draft.amountMinor;
  const account = accounts.find((a) => a.id === body.accountId)?.name;
  const details = [
    draft.method === "POST" && isId(body.id) ? `draftId ${body.id}` : null,
    typeof body.type === "string" ? body.type : null,
    typeof amount === "number" ? `${toMajor(Math.abs(amount))} taka` : null,
    account ? `account “${account}”` : null,
  ].filter(Boolean);
  return details.length ? `${draft.summary} [${details.join(", ")}]` : draft.summary;
}

export function describeDrafts(drafts: Draft[], accounts: Accounts): string {
  return `proposed for confirmation, not saved yet: ${drafts.map((d) => describeDraft(d, accounts)).join(", ")}`;
}
